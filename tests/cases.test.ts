// Pruebas de extremo a extremo: ejecutan programas .choom con el intérprete real
// (igual que `npm start -- archivo.choom`) y comparan lo que imprimen.
//
// - tests/cases/*.choom: cada uno tiene su salida esperada en un .out con el mismo nombre.
//   Los casos de error esperan además que el proceso termine con código 1.
// - examples/*.choom: deben ejecutarse completos y sin errores.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const ERROR_TAG = /^\[(GLITCH|BREACH FALLIDO|FLATLINE)\]/m;

interface RunOutput {
  output: string; // stdout seguido de stderr (los errores siempre se imprimen al final)
  failed: boolean; // el proceso terminó con un código distinto de 0
}

function runChoom(file: string): Promise<RunOutput> {
  return new Promise((resolve) => {
    execFile(process.execPath, ["--import", "tsx", "main.ts", file], { cwd: ROOT }, (error, stdout, stderr) => {
      resolve({ output: normalize(stdout + stderr), failed: error !== null });
    });
  });
}

// Git en Windows puede convertir los saltos de línea a CRLF; se comparan como LF.
function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").trimEnd();
}

function choomFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir))
    .filter((name) => name.endsWith(".choom"))
    .sort();
}

describe("casos con salida esperada (tests/cases)", { concurrency: true }, () => {
  for (const name of choomFiles("tests/cases")) {
    test(name, async () => {
      const expected = normalize(readFileSync(join(ROOT, "tests/cases", name.replace(/\.choom$/, ".out")), "utf8"));
      const { output, failed } = await runChoom(join("tests/cases", name));
      assert.equal(output, expected);
      assert.equal(failed, ERROR_TAG.test(expected), "código de salida");
    });
  }
});

describe("los ejemplos corren sin errores (examples)", { concurrency: true }, () => {
  for (const name of choomFiles("examples")) {
    test(name, async () => {
      const { output, failed } = await runChoom(join("examples", name));
      assert.ok(!failed && !ERROR_TAG.test(output), output);
    });
  }
});
