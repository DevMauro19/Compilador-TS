// main.ts
// Punto de entrada de ChoomScript.
//   npm start                    → abre el REPL
//   npm start -- archivo.choom   → ejecuta el archivo
import { readFileSync } from "node:fs";
import { interpret } from "./interpreter/interpreter.ts";
import { Environment } from "./object/object.ts";
import { startRepl } from "./repl/repl.ts";

function runFile(path: string): void {
  let source: string;
  try {
    // Se quita el BOM que algunos editores de Windows ponen al inicio del archivo.
    source = readFileSync(path, "utf8").replace(/^﻿/, "");
  } catch {
    console.error(`No se pudo leer el archivo "${path}", choom.`);
    process.exitCode = 1;
    return;
  }

  const result = interpret(source, new Environment());
  if (!result.ok) {
    result.errors.forEach((e) => console.error(e));
    process.exitCode = 1;
  }
}

const file = process.argv[2];
if (file === undefined) {
  startRepl();
} else {
  runFile(file);
}
