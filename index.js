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
      details {
        margin-left: 16px;
      }
    </style>
  </head>
  <body>
    <h1>Your project depends on ${depCount.toLocaleString()} npm packages</h1>
    <div id="app"></div>

    <hr>

    <small>Note, numbers show <em>unique</em> package counts, so won’t add up when multiple child packages depend on the same package</small>

    <script>window.__DEPS__ = ${JSON.stringify(depData)}</script>

    <script>
      const makeDepEl = (dep) => {
        const detailsEl = document.createElement('details');

        const summaryEl = document.createElement('summary');
        summaryEl.textContent = dep.name + ' (' + dep.descendantCount.toLocaleString() + ')';
        detailsEl.appendChild(summaryEl);

        const detailBodyEl = document.createElement('div');

        if (dep.dependencies.length) {
          dep.dependencies.forEach(subDep => {
            detailBodyEl.appendChild(makeDepEl(subDep));
          });
        } else {
          const nameOnlyEl = document.createElement('div');
          nameOnlyEl.textContent = 'No dependencies';
          detailBodyEl.appendChild(nameOnlyEl);
        }

        detailsEl.appendChild(detailBodyEl);

        return detailsEl;
      }


      window.__DEPS__.forEach(dep => {
        document.getElementById('app').appendChild(makeDepEl(dep));
      });
    </script>
  </body>
</html>
`;

const parseListData = listData => {
  const parseDeps = (depObject, packages = new Set()) => {
    const deps = Object.entries(depObject).map(([name, data]) => {
      packages.add(name);
      const [dependencies, descendantPackages] = parseDeps(data.dependencies || {});

      descendantPackages.forEach(item => packages.add(item));

      return {
        name,
        descendantCount: descendantPackages.size,
        version: data.version,
        dependencies,
      };
    });

    deps.sort((a, b) => b.descendantCount - a.descendantCount);

    return [deps, packages];
  };

  const [parsedDeps, packageNames] = parseDeps(listData.dependencies);

  return [parsedDeps, packageNames.size];
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
  const [depData, depCount] = parseListData(list);

  const html = makeHtml(depCount, depData);

  serveFile(html);
});
