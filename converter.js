const fs = require("fs");

// Simple UUID generator (no external deps)
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Create typed attribute
function createAttribute(classId, name) {
  return {
    _type: "UMLAttribute",
    _id: uuidv4(),
    name,
    _parent: { $ref: classId }
  };
}

// Create typed operation
function createOperation(classId, name) {
  return {
    _type: "UMLOperation",
    _id: uuidv4(),
    name,
    _parent: { $ref: classId }
  };
}

function parsePlantUML(text) {
  const classes = [];
  const associations = [];
  const notes = [];

  // Parse classes with bodies
  const classRegex = /class\s+([\w<>,]+)\s*\{([\s\S]*?)\}/g;
  let match;
  while ((match = classRegex.exec(text)) !== null) {
    const name = match[1];
    const bodyLines = match[2]
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);

    // Create class
    const classId = uuidv4();
    const classObj = {
      _type: "UMLClass",
      _id: classId,
      name,
      // Attributes and operations will be typed objects
      attributes: [],
      operations: [],
      _parent: { $ref: "MODEL1" }
    };

    // Parse attributes and operations
    for (const line of bodyLines) {
      if (line.startsWith("-")) {
        const attrName = line.replace(/^-+\s*/, "");
        classObj.attributes.push(createAttribute(classId, attrName));
      } else if (line.startsWith("+")) {
        const opName = line.replace(/^\++\s*/, "");
        classObj.operations.push(createOperation(classId, opName));
      }
    }

    classes.push(classObj);
  }

  // Parse associations: A --> B : label
  const assocRegex = /(\w+)\s+-->\s+(\w+)\s*:?([^\n]*)/g;
  while ((match = assocRegex.exec(text)) !== null) {
    const sourceName = match[1];
    const targetName = match[2];
    const label = (match[3] || "").trim();
    associations.push({
      _type: "UMLAssociation",
      _id: uuidv4(),
      sourceName,
      targetName,
      label,
      _parent: { $ref: "MODEL1" }
    });
  }

  // Parse notes: note <pos> of Class ... end note
  const noteRegex = /note\s+\w+\s+of\s+(\w+)([\s\S]*?)end note/g;
  while ((match = noteRegex.exec(text)) !== null) {
    const target = match[1];
    const doc = match[2].trim().replace(/\r?\n\s*/g, " ");
    notes.push({
      _type: "UMLNote",
      _id: uuidv4(),
      name: `${target} Notes`,
      documentation: doc,
      targetName: target,
      _parent: { $ref: "MODEL1" }
    });
  }

  return { classes, associations, notes };
}

function createClassView(cls, x, y) {
  return {
    _type: "UMLClassView",
    _id: uuidv4(),
    model: { $ref: cls._id },
    _parent: { $ref: "DIAG1" },
    containerView: { $ref: "DIAG1" },
    bounds: { x, y, width: 200, height: 140 }
  };
}

function createAssociationWithRefs(assoc, classes) {
  const sourceClass = classes.find(c => c.name.startsWith(assoc.sourceName));
  const targetClass = classes.find(c => c.name.startsWith(assoc.targetName));
  if (!sourceClass || !targetClass) {
    throw new Error(`Association could not resolve classes: ${assoc.sourceName} --> ${assoc.targetName}`);
  }
  return {
    _type: "UMLAssociation",
    _id: assoc._id,
    end1: { reference: { $ref: sourceClass._id }, name: assoc.label || "" },
    end2: { reference: { $ref: targetClass._id } },
    _parent: { $ref: "MODEL1" }
  };
}

function createAssociationView(assocModel, sourceView, targetView) {
  return {
    _type: "UMLAssociationView",
    _id: uuidv4(),
    model: { $ref: assocModel._id },
    _parent: { $ref: "DIAG1" },
    containerView: { $ref: "DIAG1" },
    head: { $ref: targetView._id },
    tail: { $ref: sourceView._id }
  };
}

function createNoteView(note, x, y) {
  return {
    _type: "UMLNoteView",
    _id: uuidv4(),
    model: { $ref: note._id },
    _parent: { $ref: "DIAG1" },
    containerView: { $ref: "DIAG1" },
    bounds: { x, y, width: 260, height: 120 }
  };
}

// Main
const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.error("Usage: node converter.js input.puml output.mdj");
  process.exit(1);
}

const text = fs.readFileSync(input, "utf8");
const { classes, associations, notes } = parsePlantUML(text);

// Lay out class views
const classViews = classes.map((cls, i) => {
  const row = Math.floor(i / 3);
  const col = i % 3;
  return createClassView(cls, 120 + col * 260, 120 + row * 200);
});

// Convert associations to reference actual class IDs
const assocModels = associations.map(a => createAssociationWithRefs(a, classes));

// Create association views linking class views
const assocViews = assocModels.map(am => {
  const end1ClassId = am.end1.reference.$ref;
  const end2ClassId = am.end2.reference.$ref;
  const sourceView = classViews.find(v => v.model.$ref === end1ClassId);
  const targetView = classViews.find(v => v.model.$ref === end2ClassId);
  return createAssociationView(am, sourceView, targetView);
});

// Place notes near their target classes
const noteViews = notes.map((note) => {
  const targetClass = classes.find(c => c.name.startsWith(note.targetName));
  const targetView = classViews.find(v => v.model.$ref === targetClass?._id);
  const x = targetView ? (targetView.bounds.x + targetView.bounds.width + 40) : 600;
  const y = targetView ? targetView.bounds.y : 120;
  return createNoteView(note, x, y);
});

// Build diagram (views only under diagram)
const diagram = {
  _type: "UMLClassDiagram",
  _id: "DIAG1",
  name: "GeneratedDiagram",
  _parent: { $ref: "MODEL1" },
  ownedViews: [...classViews, ...assocViews, ...noteViews]
};

// Build project (model owns semantic elements + diagram)
const project = {
  _type: "Project",
  _id: uuidv4(),
  name: "ConvertedProject",
  ownedElements: [
    {
      _type: "UMLModel",
      _id: "MODEL1",
      name: "Main",
      ownedElements: [
        ...classes,
        ...assocModels,
        ...notes,
        diagram
      ]
    }
  ]
};

fs.writeFileSync(output, JSON.stringify(project, null, 2));
console.log(`Converted ${input} → ${output}`);
