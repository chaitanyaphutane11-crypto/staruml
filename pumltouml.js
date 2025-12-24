// puml2uml.js
// Simple converter: PlantUML class diagram -> StarUML JSON

const fs = require('fs');

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error("Usage: node puml2uml.js input.puml output.uml");
  process.exit(1);
}

const puml = fs.readFileSync(input, 'utf8');

// Regex to capture class definitions
const classRegex = /class\s+(\w+)/g;
let match;
const classes = [];

while ((match = classRegex.exec(puml)) !== null) {
  classes.push({
    _type: "UMLClass",
    name: match[1]
  });
}

// Regex to capture inheritance (Generalization)
const genRegex = /(\w+)\s+<\|\--\s+(\w+)/g;
const generalizations = [];
while ((match = genRegex.exec(puml)) !== null) {
  generalizations.push({
    _type: "UMLGeneralization",
    source: match[2],
    target: match[1]
  });
}

// Build StarUML JSON structure
const umlJson = {
  _type: "UMLModel",
  name: "ConvertedModel",
  ownedElements: [...classes, ...generalizations]
};

fs.writeFileSync(output, JSON.stringify(umlJson, null, 2));
console.log(`Converted ${input} → ${output}`);
