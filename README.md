# ChoomScript

> Intérprete de un lenguaje con temática de **Cyberpunk 2077**, escrito en TypeScript.
> Proyecto del curso de Compiladores · Universidad EIA.

```choom
choom saludar = quickhack(nombre) {
  delta "Wake up, " + nombre + ". We have a city to burn.";
};
holo(saludar("Samurai"));
```

ChoomScript recorre el camino completo de un intérprete:
**código fuente → lexer → tokens → parser → AST → evaluador → resultado o error**.

## Integrantes

- Carlos Mauricio Velasco Chavarro
- Pablo Escudero Vargas
- Santiago Pérez Arango

## Instalación

Requisito: **Node.js 22 o superior** (incluye npm).

```bash
git clone https://github.com/DevMauro19/Compilador-TS.git
cd Compilador-TS
npm install
```

No hay paso de compilación: [tsx](https://github.com/privatenumber/tsx) ejecuta el TypeScript directamente.

## Ejecución

El intérprete acepta las **dos modalidades de entrada**:

| Modalidad | Comando |
|---|---|
| Archivo | `npm start -- examples/05_funciones.choom` |
| REPL (consola interactiva) | `npm start` |

También se puede ejecutar sin npm: `npx tsx main.ts archivo.choom`.

En el **REPL** las variables se conservan entre líneas. Si una línea deja `(`, `[` o `{` sin cerrar, el REPL sigue leyendo (`...>`) hasta que se cierren, así se pueden escribir quickhacks de varias líneas. Para salir: `jackout` o `Ctrl+C`.

```text
choom> choom doble = quickhack(x) {
  ...>   x * 2
  ...> };
choom> doble(21)
42
choom> jackout
Jacked out. Nos vemos en el Afterlife, choom.
```

Al ejecutar un archivo, si hay un error se imprime en la salida de error y el proceso termina con código 1.

## Pruebas

```bash
npm test            # toda la suite (lexer, parser, evaluador y programas completos)
npm run typecheck   # verificación de tipos de TypeScript
```

| Archivo | Qué prueba |
|---|---|
| `tests/lexer.test.ts` | Tokens, posiciones (línea y columna), comentarios y errores léxicos |
| `tests/parser.test.ts` | Forma del AST, precedencia, asociatividad y errores sintácticos |
| `tests/evaluator.test.ts` | Ejecución, ámbitos, closures, builtins y errores de ejecución |
| `tests/cases.test.ts` | Ejecuta cada `tests/cases/*.choom` con el intérprete real y compara su salida con el `.out` del mismo nombre; además verifica que todos los `examples/` corran sin errores |

`tests/cases/` tiene 9 programas válidos (`01` a `09`) y 14 que producen errores (`10` a `23`): léxicos, sintácticos y de ejecución, cada uno con su resultado esperado.

## El lenguaje

### Palabras reservadas: el glosario de Night City

| ChoomScript | Equivale a | Por qué |
|---|---|---|
| `choom` | `let` | Declaras a tu *choom* (compañero), que te guarda un valor |
| `quickhack` | `function` | Un programa que se le sube a unos objetivos: los argumentos |
| `delta` | `return` | *Hacer delta* es largarse: sales del quickhack con un valor |
| `online` / `offline` | `true` / `false` | El estado de un dispositivo en el HUD |
| `scan` | `if` | El escáner revisa la condición antes de actuar |
| `backdoor` | `else` | La entrada alterna cuando la principal está cerrada |
| `netrun` | `while` | La sesión sigue corriendo mientras la condición esté online |
| `ping` | `for` | Ping recorre la red nodo por nodo, paso a paso |

### Sintaxis

```choom
// Comentarios de línea con //. El punto y coma al final es opcional.

choom eddies = 1500;              // declarar
eddies = eddies - 500;            // reasignar (la variable debe existir)

scan (eddies >= 1000) {           // if / else if / else
  holo("merc");
} backdoor scan (eddies > 0) {
  holo("streetkid");
} backdoor {
  holo("en la quiebra");
}

choom ram = 0;
netrun (ram < 3) {                // while
  ram = ram + 1;
}

ping (choom i = 0; i < 3; i = i + 1) {   // for (inicialización; condición; actualización)
  holo("nodo", i);
}

choom factorial = quickhack(n) {  // función
  scan (n <= 1) { delta 1; }
  delta n * factorial(n - 1);
};

choom bandas = ["Maelstrom", "Valentinos"];      // arreglo
choom merc = {"nombre": "V", "nivel": 50};       // hash
holo(bandas[0], merc["nombre"]);
```

### Tipos de datos

| Tipo | Ejemplo |
|---|---|
| `INTEGER` | `2077`, `-5` (solo enteros) |
| `STRING` | `"Night City"`, `'V'` (escapes: `\n`, `\t`, `\"`, `\'`, `\\`) |
| `BOOLEAN` | `online`, `offline` |
| `ARRAY` | `[1, "dos", online]` |
| `HASH` | `{"clave": valor}`; las claves pueden ser enteros, cadenas o booleanos |
| `FUNCTION` | `quickhack(x) { x * 2 }` |
| `NULL` | lo que devuelve, por ejemplo, una clave inexistente en un hash |

Solo `offline` y `null` se consideran falsos en una condición; `0`, `""` y `[]` son verdaderos.

### Operadores (de menor a mayor precedencia)

| Precedencia | Operadores | Asociatividad |
|---|---|---|
| 1 | `=` | derecha |
| 2 | `\|\|` (con cortocircuito) | izquierda |
| 3 | `&&` (con cortocircuito) | izquierda |
| 4 | `==` `!=` | izquierda |
| 5 | `<` `>` `<=` `>=` | izquierda |
| 6 | `+` `-` | izquierda |
| 7 | `*` `/` `%` | izquierda |
| 8 | `-x` `!x` (prefijos) | — |
| 9 | `**` | derecha |
| 10 | llamada `f(x)` e índice `a[i]` | izquierda |

`/` es división entera (`7 / 2` da `3`). `+` también concatena cadenas. No hay conversiones implícitas: `"eddies: " + 5` es un error; se usa `str(5)`.

### Funciones integradas

| Función | Descripción |
|---|---|
| `holo(a, b, ...)` | Imprime los valores separados por espacio |
| `len(x)` | Elementos de un arreglo, pares de un hash o caracteres de una cadena |
| `first(arr)` / `last(arr)` | Primer y último elemento (`null` si está vacío) |
| `rest(arr)` | Arreglo nuevo sin el primer elemento |
| `push(arr, x)` | Arreglo nuevo con `x` al final (el original no cambia) |
| `str(x)` | Convierte cualquier valor a cadena |
| `int(x)` | Convierte una cadena numérica o un booleano a entero |
| `type(x)` | Nombre del tipo: `"INTEGER"`, `"STRING"`, `"ARRAY"`... |

### Errores

Cada etapa reporta sus errores con una etiqueta, el tipo de error y, cuando es posible, la línea y la columna:

| Etapa | Etiqueta | Ejemplo |
|---|---|---|
| Lexer | `[GLITCH]` (la señal llegó corrupta) | `[GLITCH] Error léxico en línea 2, columna 23: carácter no reconocido '@'` |
| Parser | `[BREACH FALLIDO]` (los tokens no encajan en la secuencia que pide la gramática) | `[BREACH FALLIDO] Error sintáctico en línea 3, columna 17: se esperaba ')' pero llegó '{'` |
| Evaluador | `[FLATLINE]` (el programa murió mientras se ejecutaba) | `[FLATLINE] Error de ejecución en línea 3, columna 15: división por cero` |

Si hay un error léxico o sintáctico, el programa no se ejecuta. Un error de ejecución detiene el programa en ese punto: lo que se imprimió antes se conserva.

## Estructura del proyecto

```text
Compilador-TS/
├── token/token.ts            tipos de token y palabras reservadas
├── lexer/lexer.ts            análisis léxico: texto → tokens
├── ast/ast.ts                nodos del árbol de sintaxis abstracta
├── parser/parser.ts          análisis sintáctico (Pratt): tokens → AST
├── object/object.ts          valores en tiempo de ejecución y entornos (ámbitos)
├── evaluator/
│   ├── evaluator.ts          recorre el AST y ejecuta el programa
│   └── builtins.ts           funciones integradas
├── interpreter/interpreter.ts  une las etapas: lexer → parser → evaluador
├── repl/repl.ts              REPL interactivo
├── main.ts                   punto de entrada (REPL o archivo)
├── examples/                 un programa por característica
├── tests/                    pruebas automáticas y casos con salida esperada
└── docs/design.md            gramática, arquitectura y decisiones de diseño
```

## Ejemplos

| Archivo | Característica |
|---|---|
| `01_variables.choom` | Declaración, asignación y consulta |
| `02_expresiones.choom` | Aritméticas, relacionales y lógicas; precedencia |
| `03_condicionales.choom` | `scan` / `backdoor scan` / `backdoor`, anidados |
| `04_ciclos.choom` | `netrun` y `ping`, ciclos anidados, `delta` dentro de un ciclo |
| `05_funciones.choom` | Parámetros, retorno y recursión |
| `06_ambitos.choom` | Variables locales y globales con el mismo nombre |
| `07_estructuras.choom` | Arreglos, hashes y estructuras anidadas |
| `08_builtins.choom` | Todas las funciones integradas |
| `09_extensiones.choom` | Closures, funciones de orden superior y cortocircuito |
| `10_gig_completo.choom` | Programa completo que combina todo lo anterior |

La gramática en EBNF, las decisiones de diseño y las limitaciones conocidas están en [docs/design.md](docs/design.md).
