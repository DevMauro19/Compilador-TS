// Pruebas del lexer: qué tokens produce, en qué posición y qué errores léxicos detecta.
import test from "node:test";
import assert from "node:assert/strict";

import { Lexer } from "../lexer/lexer.ts";
import { Token, TokenTypes } from "../token/token.ts";

function tokenize(source: string): { tokens: Token[]; errors: string[] } {
  const lexer = new Lexer(source);
  const tokens: Token[] = [];
  let tok: Token;
  do {
    tok = lexer.nextToken();
    tokens.push(tok);
  } while (tok.type !== TokenTypes.EOF);
  return { tokens, errors: lexer.errors };
}

test("reconoce las palabras reservadas de Night City", () => {
  const { tokens } = tokenize("choom quickhack delta online offline scan backdoor netrun ping nombre");
  assert.deepEqual(
    tokens.map((t) => t.type),
    [
      TokenTypes.LET,
      TokenTypes.FUNCTION,
      TokenTypes.RETURN,
      TokenTypes.TRUE,
      TokenTypes.FALSE,
      TokenTypes.IF,
      TokenTypes.ELSE,
      TokenTypes.WHILE,
      TokenTypes.FOR,
      TokenTypes.IDENT,
      TokenTypes.EOF,
    ]
  );
});

test("distingue operadores de uno y dos caracteres", () => {
  const { tokens, errors } = tokenize("= == ! != * ** < <= > >= && || + - / %");
  assert.deepEqual(errors, []);
  assert.deepEqual(
    tokens.map((t) => t.literal),
    ["=", "==", "!", "!=", "*", "**", "<", "<=", ">", ">=", "&&", "||", "+", "-", "/", "%", ""]
  );
});

test("tokeniza una declaración completa con literales y delimitadores", () => {
  const { tokens } = tokenize('choom gig = {"pago": [100, 250]};');
  assert.deepEqual(
    tokens.map((t) => [t.type, t.literal]),
    [
      [TokenTypes.LET, "choom"],
      [TokenTypes.IDENT, "gig"],
      [TokenTypes.ASSIGN, "="],
      [TokenTypes.LBRACE, "{"],
      [TokenTypes.STRING, "pago"],
      [TokenTypes.COLON, ":"],
      [TokenTypes.LBRACKET, "["],
      [TokenTypes.INT, "100"],
      [TokenTypes.COMMA, ","],
      [TokenTypes.INT, "250"],
      [TokenTypes.RBRACKET, "]"],
      [TokenTypes.RBRACE, "}"],
      [TokenTypes.SEMICOLON, ";"],
      [TokenTypes.EOF, ""],
    ]
  );
});

test("registra la línea y la columna donde empieza cada token", () => {
  const { tokens } = tokenize("choom x = 5;\n  holo(x);");
  const holo = tokens.find((t) => t.literal === "holo");
  assert.deepEqual([tokens[0].line, tokens[0].column], [1, 1]);
  assert.deepEqual([tokens[3].line, tokens[3].column], [1, 11]); // el 5
  assert.deepEqual([holo?.line, holo?.column], [2, 3]);
});

test("ignora espacios, saltos de línea y comentarios //", () => {
  const { tokens } = tokenize("// encabezado\nchoom x = 1; // al final\n// otro\n");
  assert.deepEqual(
    tokens.map((t) => t.literal),
    ["choom", "x", "=", "1", ";", ""]
  );
});

test("procesa secuencias de escape y acepta comillas simples", () => {
  const { tokens } = tokenize(`"linea1\\nlinea2\\t\\"fin\\"" 'V'`);
  assert.equal(tokens[0].literal, 'linea1\nlinea2\t"fin"');
  assert.equal(tokens[1].literal, "V");
});

test("acepta tildes y ñ en los identificadores", () => {
  const { tokens, errors } = tokenize("choom año = 2077;");
  assert.deepEqual(errors, []);
  assert.deepEqual([tokens[1].type, tokens[1].literal], [TokenTypes.IDENT, "año"]);
});

test("error léxico: carácter no reconocido con su posición", () => {
  const { tokens, errors } = tokenize("choom x = 5 @ 3;");
  assert.ok(tokens.some((t) => t.type === TokenTypes.ILLEGAL));
  assert.deepEqual(errors, [
    "[GLITCH] Error léxico en línea 1, columna 13: carácter no reconocido '@'",
  ]);
});

test("error léxico: un & o | suelto sugiere el operador doble", () => {
  const { errors } = tokenize("online & offline | online");
  assert.deepEqual(errors, [
    "[GLITCH] Error léxico en línea 1, columna 8: carácter no reconocido '&' (¿querías decir '&&'?)",
    "[GLITCH] Error léxico en línea 1, columna 18: carácter no reconocido '|' (¿querías decir '||'?)",
  ]);
});

test("error léxico: cadena sin cerrar en su línea", () => {
  const { errors } = tokenize('choom x = 1;\nholo("sin cerrar);\nholo(x);');
  assert.deepEqual(errors, [
    "[GLITCH] Error léxico en línea 2, columna 6: cadena sin cerrar: falta la comilla de cierre en esta línea",
  ]);
});
