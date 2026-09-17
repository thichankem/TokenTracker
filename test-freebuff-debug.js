const {resolveFreebuffDbPaths} = require('./src/lib/rollout');
const {readSqliteJsonRows} = require('./src/lib/sqlite-reader');
const paths = resolveFreebuffDbPaths(process.env);
const rows = readSqliteJsonRows(paths[0], "SELECT seq, metrics_json, typeof(metrics_json) as type FROM messages WHERE role='assistant' AND metrics_json IS NOT NULL AND metrics_json != '{}' LIMIT 1", {label:'test',readOnly:true,timeout:30000});
const row = rows[0];
console.log('Type of metrics_json:', typeof row.metrics_json);
console.log('Is string:', typeof row.metrics_json === 'string');
console.log('Value:', JSON.stringify(row.metrics_json).slice(0, 200));
