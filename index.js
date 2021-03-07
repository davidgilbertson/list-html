const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const html = `
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
<div id="app"></div>
<script>window.__DEPS__ = %REPLACE_ME%</script>

<script>
  const makeDepEl = (dep) => {
    const depBodyEl = document.createElement('div');
    depBodyEl.classList.add('dep');

    if (dep.dependencies.length) {
      const detailsEl = document.createElement('details');
      const summaryEl = document.createElement('summary');
      summaryEl.textContent = dep.name + ' ' + dep.descendantCount.toLocaleString();

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

console.info('Getting list of packages...');

childProcess.exec('npm ls --json', {maxBuffer: 5000 * 1024}, (err, stdout) => {
  const list = JSON.parse(stdout);
  const [parsed] = parseDeps(list.dependencies);

  const htmlWithData = html.replace('%REPLACE_ME%', JSON.stringify(parsed));

  const outputFilePath = path.resolve(__dirname, 'npm-list.html');

  fs.writeFileSync(outputFilePath, htmlWithData);

  console.info(`Created ${outputFilePath}, attempting to open...`);

  const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';

  const exec = `${start} file://${outputFilePath}`;
  childProcess.exec(exec);
});
