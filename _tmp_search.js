const fs = require("fs");
const p = require("path");
const root = "node_modules/@whiskeysockets/baileys/lib";
function walk(d) {
    for (const f of fs.readdirSync(d)) {
        const fp = p.join(d, f);
        const s = fs.statSync(fp);
        if (s.isDirectory()) walk(fp);
        else if (f.endsWith(".js")) {
            const lines = fs.readFileSync(fp, "utf8").split(/\r?\n/);
            lines.forEach((l, i) => {
                if (l.includes("matching sessions")) console.log(fp + ":" + (i + 1) + ": " + l.trim());
            });
        }
    }
}
walk(root);
console.log("done");
