// Pruebas del evaluador: ejecutan código completo con interpret() y revisan el resultado.
import test from "node:test";
import assert from "node:assert/strict";

import { interpret } from "../interpreter/interpreter.ts";
import { Environment } from "../object/object.ts";

// Ejecuta el código y devuelve el valor de la última sentencia como texto.
function run(source: string): string {
  const result = interpret(source, new Environment());
  assert.ok(result.ok, result.ok ? "" : result.errors.join("\n"));
  return result.value.inspect();
}

// Ejecuta el código esperando un error y devuelve el mensaje.
function runError(source: string): string {
  const result = interpret(source, new Environment());
  assert.ok(!result.ok, "se esperaba un error");
  return result.errors.join("\n");
}

test("aritmética entera con precedencia correcta", () => {
  assert.equal(run("2 + 3 * 4 ** 2 - -1;"), "51");
  assert.equal(run("(2 + 3) * 4;"), "20");
  assert.equal(run("7 / 2;"), "3"); // división entera
  assert.equal(run("-7 / 2;"), "-3");
  assert.equal(run("17 % 5;"), "2");
  assert.equal(run("2 ** 3 ** 2;"), "512");
});

test("comparaciones y operadores lógicos", () => {
  assert.equal(run("1 < 2 && 2 <= 2;"), "online");
  assert.equal(run("!online || offline;"), "offline");
  assert.equal(run('"V" == "V" && 3 != 4;'), "online");
  assert.equal(run("offline == offline;"), "online");
});

test("&& y || evalúan en cortocircuito", () => {
  const program = `
    choom llamadas = 0;
    choom marcar = quickhack() { llamadas = llamadas + 1; delta online; };
    offline && marcar();
    online || marcar();
    llamadas;
  `;
  assert.equal(run(program), "0");
  assert.equal(run("choom n = 0; choom f = quickhack() { n = n + 1; online }; online && f(); n;"), "1");
});

test("scan, backdoor scan y backdoor, incluidos anidados", () => {
  const clasificar = `
    choom clasificar = quickhack(nivel) {
      scan (nivel >= 50) {
        scan (nivel >= 90) { delta "leyenda"; } backdoor { delta "merc"; }
      } backdoor scan (nivel >= 10) {
        delta "novato";
      } backdoor {
        delta "gonk";
      }
    };
  `;
  assert.equal(run(clasificar + "clasificar(95);"), "leyenda");
  assert.equal(run(clasificar + "clasificar(60);"), "merc");
  assert.equal(run(clasificar + "clasificar(20);"), "novato");
  assert.equal(run(clasificar + "clasificar(1);"), "gonk");
  assert.equal(run("scan (offline) { 1 }"), "null");
});

test("netrun y ping repiten mientras la condición esté online", () => {
  assert.equal(run("choom i = 0; choom s = 0; netrun (i < 5) { s = s + i; i = i + 1; } s;"), "10");
  assert.equal(run("choom s = 0; ping (choom i = 1; i <= 4; i = i + 1) { s = s + i; } s;"), "10");
  assert.equal(run("choom i = 9; ping (i = 0; i < 3; i = i + 1) { } i;"), "3");
});

test("delta sale del quickhack aunque esté dentro de un ciclo", () => {
  const program = `
    choom buscar = quickhack(lista, objetivo) {
      ping (choom i = 0; i < len(lista); i = i + 1) {
        scan (lista[i] == objetivo) { delta i; }
      }
      delta -1;
    };
    buscar([4, 8, 15], 8);
  `;
  assert.equal(run(program), "1");
});

test("recursión", () => {
  const fib = "choom fib = quickhack(n) { scan (n < 2) { delta n; } delta fib(n - 1) + fib(n - 2); };";
  assert.equal(run(fib + "fib(15);"), "610");
});

test("ámbitos: una variable local tapa a la global sin modificarla", () => {
  assert.equal(run("choom x = 1; choom f = quickhack() { choom x = 99; x }; f(); x;"), "1");
  assert.equal(run("choom x = 1; choom f = quickhack() { choom x = 99; x }; f();"), "99");
  assert.equal(run("choom x = 1; choom f = quickhack(x) { x * 2 }; f(21) + x;"), "43");
});

test("ámbitos: asignar sin choom modifica la variable del ámbito exterior", () => {
  assert.equal(run("choom c = 0; choom inc = quickhack() { c = c + 1; }; inc(); inc(); c;"), "2");
});

test("closures y funciones de orden superior", () => {
  const contador = `
    choom crearContador = quickhack() {
      choom cuenta = 0;
      delta quickhack() { cuenta = cuenta + 1; delta cuenta; };
    };
    choom a = crearContador();
    choom b = crearContador();
    a(); a(); b();
    [a(), b()];
  `;
  assert.equal(run(contador), "[3, 2]");

  const mapear = `
    choom mapear = quickhack(lista, f) {
      choom salida = [];
      ping (choom i = 0; i < len(lista); i = i + 1) { salida = push(salida, f(lista[i])); }
      delta salida;
    };
    mapear([1, 2, 3], quickhack(x) { x * 10 });
  `;
  assert.equal(run(mapear), "[10, 20, 30]");
});

test("arreglos y hashes", () => {
  assert.equal(run("choom a = [10, 20, 30]; a[1];"), "20");
  assert.equal(run('choom h = {"nombre": "V", 2077: online}; h["nombre"];'), "V");
  assert.equal(run('{"a": 1}["no existe"];'), "null");
  assert.equal(run('{"a": 1, "a": 2};'), '{"a": 2}');
  assert.equal(run('["V", 1, online, [2]];'), '["V", 1, online, [2]]');
});

test("funciones integradas", () => {
  assert.equal(run('len([1, 2, 3]) + len("choom") + len({"a": 1});'), "9");
  assert.equal(run("first([7, 8, 9]);"), "7");
  assert.equal(run("last([7, 8, 9]);"), "9");
  assert.equal(run("rest([7, 8, 9]);"), "[8, 9]");
  assert.equal(run("choom a = [1]; choom b = push(a, 2); [a, b];"), "[[1], [1, 2]]");
  assert.equal(run('str(2077) + "!";'), "2077!");
  assert.equal(run('int("42") + int(online);'), "43");
  assert.equal(run('type("V");'), "STRING");
  assert.equal(run("first([]);"), "null");
});

test("errores de ejecución con la posición donde ocurrieron", () => {
  const cases: Array<[string, string]> = [
    ["choom a = 10;\nchoom b = a / 0;", "línea 2, columna 13: división por cero"],
    ["holo(nada);", "línea 1, columna 6: 'nada' no está definido (¿olvidaste declararlo con choom?)"],
    ["z = 3;", "línea 1, columna 3: no se puede asignar a 'z' porque no ha sido declarado; usa choom z = ..."],
    ['1 + "a";', "línea 1, columna 3: tipos incompatibles: INTEGER + STRING"],
    ["choom f = quickhack(a, b) { a };\nf(1);", "línea 2, columna 2: f espera 2 argumento(s) y recibió 1"],
    ["choom x = 5; x(1);", "línea 1, columna 15: 'x' es un INTEGER, no un quickhack: no se puede llamar"],
    ["[1, 2][5];", "línea 1, columna 7: índice fuera de rango: 5 (el arreglo tiene 2 elementos)"],
    ['int("abc");', 'línea 1, columna 4: int() no puede convertir "abc" a entero'],
    ["-online;", "línea 1, columna 1: el operador '-' no se puede aplicar a BOOLEAN"],
    ["2 ** 60;", "línea 1, columna 3: desbordamiento de entero"],
  ];
  for (const [source, expected] of cases) {
    assert.equal(runError(source), `[FLATLINE] Error de ejecución en ${expected}`, source);
  }
});

test("un error dentro de un quickhack apunta a la línea del cuerpo", () => {
  const program = "choom f = quickhack(a) {\n  delta a / 0;\n};\nf(1);";
  assert.equal(runError(program), "[FLATLINE] Error de ejecución en línea 2, columna 11: división por cero");
});

test("una recursión sin caso base es un error del lenguaje, no un crash", () => {
  assert.match(runError("choom f = quickhack(n) { f(n + 1) }; f(0);"), /recursión demasiado profunda/);
});

test("el programa se detiene en la etapa que falla primero", () => {
  // Hay un error léxico (@) y uno sintáctico (paréntesis): solo se reporta el léxico.
  assert.match(runError("holo((1 @ 2);"), /^\[GLITCH\]/);
  // Error sintáctico: el programa no llega a ejecutarse.
  assert.match(runError("holo(1);\nchoom = 2;"), /^\[BREACH FALLIDO\]/);
});
