const fs = require("fs");

const p = "app/api/admin/ai-dispatcher/route.ts";
let s = fs.readFileSync(p, "utf8");

s = s.replace(
  'import { getAdminSupabase } from "@/lib/supabaseAdmin";',
  'import { getAdminSupabase } from "@/lib/supabase";'
);

s = s.replace(
  '    const supabase = getAdminSupabase();',
  '    const supabase = getAdminSupabase();\n\n    if (!supabase) {\n      return NextResponse.json(\n        { error: "Supabase admin configuration is missing" },\n        { status: 500 }\n      );\n    }'
);

fs.writeFileSync(p, s, "utf8");

console.log("AI DISPATCHER IMPORT FIXED");
