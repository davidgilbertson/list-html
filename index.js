#!/usr/bin/env node

const childProcess = require('child_process');
const http = require('http');

const makeHtml = (depCount, depData) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Dependencies</title>
    <style>
      html {
        font-family: system-ui, sans-serif;
        color: #333;
      }
      .dep {
        margin-left: 16px;
      }
      .name-only {
        margin-left: 12px;
      }
    </style>
  </head>
  <body>
    <h1>You depend on ${depCount.toLocaleString()} npm packages</h1>
    <div id="app"></div>
    
    <script>window.__DEPS__ = ${JSON.stringify(depData)}</script>
    
    <script>
      const makeDepEl = (dep) => {
        const depBodyEl = document.createElement('div');
        depBodyEl.classList.add('dep');
    
        if (dep.dependencies.length) {
          const detailsEl = document.createElement('details');
          const summaryEl = document.createElement('summary');
          summaryEl.textContent = dep.name + ' (' + dep.descendantCount.toLocaleString() + ')';
    
          detailsEl.appendChild(summaryEl);
    
          dep.dependencies.forEach(dep2 => {
            depBodyEl.appendChild(makeDepEl(dep2));
          });
    
          detailsEl.appendChild(depBodyEl);
    
          return detailsEl;
        }
    
        depBodyEl.classList.add('name-only');
        depBodyEl.textContent = dep.name;
    
        return depBodyEl;
      }
    
    
      window.__DEPS__.forEach(dep => {
        document.getElementById('app').appendChild(makeDepEl(dep));
      });
    </script>
  </body>
</html>
`;

const parseDeps = (depObject, treeCounter = 0) => {
  const deps = Object.entries(depObject).map(([name, data]) => {
    const [dependencies, descendantCount] = parseDeps(data.dependencies || {});

    treeCounter += descendantCount + 1;

    return {
      name,
      descendantCount,
      version: data.version,
      dependencies,
    };
  });

  deps.sort((a, b) => b.descendantCount - a.descendantCount);

  return [deps, treeCounter];
};

const serveFile = html => {
  const PORT = 19841;

  const server = http
    .createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Connection', 'close');
      res.end(html);

      server.close(err => {
        if (!err) console.info('Results served, server closed');
      });
    })
    .listen(PORT, () => {
      const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      const exec = `${start} http://localhost:${PORT}`;

      console.info(`Serving results at http://localhost:${PORT}`);
      childProcess.exec(exec);
    });
};

console.info('Running npm ls --json...');
childProcess.exec('npm ls --json', {maxBuffer: 5000 * 1024}, (err, stdout) => {
  const list = JSON.parse(stdout);
  const [depData, depCount] = parseDeps(list.dependencies);

  const html = makeHtml(depCount, depData);

  serveFile(html);
});
