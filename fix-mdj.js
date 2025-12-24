const fs = require("fs");
const path = require("path");

// Get input/output file paths from command line
const inputFile = process.argv[2];
if (!inputFile) {
  console.error("❌ Usage: node fix-mdj.js <input.mdj> [output.mdj]");
  process.exit(1);
}

const outputFile = process.argv[3] || path.basename(inputFile, ".mdj") + "_fixed.mdj";

let fixedCount = 0;
let fixedIds = [];

function traverse(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(traverse);
  } else if (obj && typeof obj === "object") {
    if (obj._type === "UMLAssociationView") {
      if (!obj.end1) {
        obj.end1 = { ref: null };
        fixedCount++;
        fixedIds.push(obj.id || "(no id) - end1");
      }
      if (!obj.end2) {
        obj.end2 = { ref: null };
        fixedCount++;
        fixedIds.push(obj.id || "(no id) - end2");
      }
      if (!obj.qualifiers) {
        obj.qualifiers = [];
        fixedCount++;
        fixedIds.push(obj.id || "(no id) - qualifiers");
      }
    }
    Object.values(obj).forEach(traverse);
  }
}

function fixMdjFile() {
  console.log(`🔎 Reading ${inputFile}...`);
  const raw = fs.readFileSync(inputFile, "utf8");
  const json = JSON.parse(raw);

  traverse(json);

  fs.writeFileSync(outputFile, JSON.stringify(json, null, 2), "utf8");
  console.log(`✅ Fixed ${fixedCount} issues in UMLAssociationView objects`);
  console.log(`💾 Saved repaired file as ${outputFile}`);

  if (fixedIds.length > 0) {
    console.log("\n📋 Associations fixed:");
    fixedIds.forEach(id => console.log(" - " + id));
  } else {
    console.log("🎉 No broken associations found.");
  }
}

fixMdjFile();
