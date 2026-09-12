const fs = require("fs");

const page = "app/admin/crm-dashboard.tsx";
const cssFile = "app/admin/admin.css";
const layout = "app/admin/layout.tsx";

let s = fs.readFileSync(page, "utf8");

const startMarker = "<style jsx>{`";
const endMarker = "`}</style>";

const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  throw new Error("STYLE_BLOCK_NOT_FOUND");
}

const css = s.slice(start + startMarker.length, end);

fs.writeFileSync(cssFile, css, "utf8");

s = s.slice(0, start) + s.slice(end + endMarker.length);

fs.writeFileSync(page, s, "utf8");

fs.writeFileSync(
  layout,
  `import "./admin.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
`,
  "utf8"
);

console.log("CSS EXTRACTED:", css.length, "bytes");
console.log("CREATED:", cssFile);
console.log("CREATED:", layout);
console.log("UPDATED:", page);
