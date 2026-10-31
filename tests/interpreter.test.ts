import test from "node:test";
import assert from "node:assert/strict";

import { Lexer } from "../lexer/lexer.ts";
import { Parser } from "../parser/parser.ts";
import { Eval } from "../evaluator/evaluator.ts";
import { Environment } from "../object/object.ts";

function evalSource(source: string, env = new Environment()) {
  const parser = new Parser(new Lexer(source));
  const program = parser.parseProgram();
  assert.equal(parser.errors.length, 0, parser.errors.join("; "));
  return Eval(program, env);
}

test("lexa cadenas, arrays y hashes", () => {
  const lexer = new Lexer('let msg = "hola"; let xs = [1, 2, 3]; let map = {"a": 10};');
  const tokens = [] as string[];

  while (true) {
    const token = lexer.nextToken();
    tokens.push(token.type);
    if (token.type === "EOF") {
      break;
    }
  }

  assert.ok(tokens.includes("STRING"));
  assert.ok(tokens.includes("["));
  assert.ok(tokens.includes("]"));
  assert.ok(tokens.includes("{"));
  assert.ok(tokens.includes(":"));
});

test("evalua arreglos y acceso por índice", () => {
  const env = new Environment();
  const result = evalSource("let a = [10, 20, 30]; a[1];", env);
  assert.equal(result.inspect(), "20");
});

test("evalua hashes con clave string", () => {
  const env = new Environment();
  const result = evalSource('let h = {"a": 1, "b": 2}; h["a"];', env);
  assert.equal(result.inspect(), "1");
});

test("aplica builtins de longitud y extraer elementos", () => {
  const env = new Environment();
  assert.equal(evalSource("len([1, 2, 3]);", env).inspect(), "3");
  assert.equal(evalSource("first([10, 20, 30]);", env).inspect(), "10");
  assert.equal(evalSource("push([1], 2);", env).inspect(), "[1, 2]");
});

test("ejecuta funciones con recursión simple", () => {
  const env = new Environment();
  const result = evalSource(
    "let fact = fn(n) { if (n <= 1) { return 1; } return n * fact(n - 1); }; fact(5);",
    env
  );
  assert.equal(result.inspect(), "120");
});

test("produce error en tiempo de ejecución para variables no definidas", () => {
  const env = new Environment();
  const result = evalSource("x + 1;", env);
  assert.match(result.inspect(), /identificador no definido/i);
});
