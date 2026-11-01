// Pruebas del parser: forma del AST, precedencia, asociatividad y errores sintácticos.
import test from "node:test";
import assert from "node:assert/strict";

import { Lexer } from "../lexer/lexer.ts";
import { Parser } from "../parser/parser.ts";
import {
  ExpressionStatement,
  ForExpression,
  FunctionLiteral,
  HashLiteral,
  IfExpression,
  LetStatement,
  Program,
  ReturnStatement,
} from "../ast/ast.ts";

function parse(source: string): { program: Program; errors: string[] } {
  const parser = new Parser(new Lexer(source));
  const program = parser.parseProgram();
  return { program, errors: parser.errors };
}

function parseOk(source: string): Program {
  const { program, errors } = parse(source);
  assert.deepEqual(errors, []);
  return program;
}

// Devuelve la expresión de la primera sentencia del programa.
function firstExpression(source: string) {
  const stmt = parseOk(source).statements[0];
  assert.ok(stmt instanceof ExpressionStatement);
  return stmt.expression;
}

test("respeta la precedencia y la asociatividad de los operadores", () => {
  // toString() pone paréntesis explícitos alrededor de cada operación.
  const cases: Array<[string, string]> = [
    ["1 + 2 * 3", "(1 + (2 * 3))"],
    ["1 - 2 - 3", "((1 - 2) - 3)"], // izquierda
    ["2 ** 3 ** 2", "(2 ** (3 ** 2))"], // ** a la derecha
    ["-2 ** 2", "(-(2 ** 2))"], // ** amarra más que el - prefijo
    ["a + b % c", "(a + (b % c))"],
    ["1 < 2 == 3 > 4", "((1 < 2) == (3 > 4))"],
    ["a || b && c", "(a || (b && c))"], // && antes que ||
    ["!a && b == c", "((!a) && (b == c))"],
    ["x = y = 3", "(x = (y = 3))"], // = a la derecha
    ["x = a || b", "(x = (a || b))"],
    ["(1 + 2) * 3", "((1 + 2) * 3)"],
    ["f(a + b, 2)[0]", "(f((a + b), 2)[0])"],
  ];
  for (const [source, expected] of cases) {
    assert.equal(parseOk(source).toString(), expected, source);
  }
});

test("choom construye un LetStatement con nombre y valor", () => {
  const stmt = parseOk("choom eddies = 500 * 2;").statements[0];
  assert.ok(stmt instanceof LetStatement);
  assert.equal(stmt.name.value, "eddies");
  assert.equal(stmt.value.toString(), "(500 * 2)");
});

test("quickhack guarda parámetros y cuerpo; delta es un ReturnStatement", () => {
  const fn = firstExpression("quickhack(a, b) { delta a + b; }");
  assert.ok(fn instanceof FunctionLiteral);
  assert.deepEqual(fn.parameters.map((p) => p.value), ["a", "b"]);
  assert.ok(fn.body.statements[0] instanceof ReturnStatement);
});

test("backdoor scan se anida como un scan dentro del bloque alterno", () => {
  const ifExp = firstExpression("scan (x > 10) { 1 } backdoor scan (x > 3) { 2 } backdoor { 3 }");
  assert.ok(ifExp instanceof IfExpression);
  const alternative = ifExp.alternative?.statements[0];
  assert.ok(alternative instanceof ExpressionStatement);
  assert.ok(alternative.expression instanceof IfExpression);
  assert.equal(alternative.expression.condition.toString(), "(x > 3)");
  assert.notEqual(alternative.expression.alternative, null);
});

test("ping tiene inicialización, condición y actualización", () => {
  const forExp = firstExpression("ping (choom i = 0; i < 3; i = i + 1) { holo(i); }");
  assert.ok(forExp instanceof ForExpression);
  assert.ok(forExp.init instanceof LetStatement);
  assert.equal(forExp.condition.toString(), "(i < 3)");
  assert.equal(forExp.update.toString(), "(i = (i + 1))");
  assert.equal(forExp.body.statements.length, 1);
});

test("parsea hashes, incluso vacíos", () => {
  const hash = firstExpression('{"nombre": "V", 1: online}');
  assert.ok(hash instanceof HashLiteral);
  assert.equal(hash.pairs.length, 2);
  const empty = firstExpression("{}");
  assert.ok(empty instanceof HashLiteral);
  assert.equal(empty.pairs.length, 0);
});

test("errores sintácticos con su posición; el parser se detiene en el primero", () => {
  const cases: Array<[string, string]> = [
    ["choom = 5;", "línea 1, columna 7: se esperaba un identificador pero llegó '='"],
    ["holo((1 + 2);", "línea 1, columna 13: se esperaba ')' pero llegó ';'"],
    ["choom x = ;", "línea 1, columna 11: se esperaba una expresión pero llegó ';'"],
    ["quickhack(1) { 1 }", "línea 1, columna 11: se esperaba un identificador pero llegó el número 1"],
    ["5 = x;", "línea 1, columna 3: solo se puede asignar a una variable, no a '5'"],
    ["scan (online) {\n  holo(1);\n", "línea 1, columna 15: este bloque '{' nunca se cerró: falta '}'"],
    ["scan online { 1 }", "línea 1, columna 6: se esperaba '(' pero llegó 'online'"],
    ["ping (choom i = 0 i < 3; i = i + 1) {}", "línea 1, columna 19: se esperaba ';' pero llegó el identificador 'i'"],
    ['{"a" 1}', "línea 1, columna 6: se esperaba ':' pero llegó el número 1"],
  ];
  for (const [source, expected] of cases) {
    const { errors } = parse(source);
    assert.deepEqual(errors, [`[BREACH FALLIDO] Error sintáctico en ${expected}`], source);
  }
});

test("un token ILLEGAL no genera un error sintáctico duplicado", () => {
  // El error del @ lo reporta el lexer; el parser solo se detiene.
  const { errors } = parse("choom x = 5;\n@");
  assert.deepEqual(errors, []);
});
