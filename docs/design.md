# Documento de diseño · ChoomScript

**Integrantes:** Carlos Mauricio Velasco Chavarro, Pablo Escudero Vargas, Santiago Pérez Arango.

## 1. Arquitectura

ChoomScript es un intérprete de recorrido de árbol (*tree-walking*) en TypeScript, construido a partir de la rama `evaluator` del repositorio del curso. Cada etapa es un módulo que solo se comunica con la siguiente:

```text
código fuente ─► Lexer ─► tokens ─► Parser ─► AST ─► Evaluador ─► resultado / error
```

| Módulo | Responsabilidad |
|---|---|
| `token/` | Tipos de token, palabras reservadas y formato de posición. |
| `lexer/` | Convierte el texto en tokens con línea y columna; detecta errores léxicos. |
| `parser/` | Parser Pratt: valida la gramática y construye el AST. |
| `ast/` | Nodos del árbol; cada uno guarda su token (de ahí salen las posiciones). |
| `object/` | Valores en tiempo de ejecución y `Environment` (ámbitos). |
| `evaluator/` | `Eval` recorre el AST; `builtins.ts` define las funciones integradas. |
| `interpreter/` | `interpret()` encadena las etapas; lo usan el REPL, los archivos y los tests. |
| `repl/`, `main.ts` | Punto de entrada: REPL o ejecución de un archivo. |

## 2. Gramática (EBNF)

```ebnf
programa    = { sentencia } ;
sentencia   = declaracion | retorno | expresion [ ";" ] ;
declaracion = "choom" IDENT "=" expresion [ ";" ] ;
retorno     = "delta" expresion [ ";" ] ;
bloque      = "{" { sentencia } "}" ;

(* De menor a mayor precedencia *)
expresion   = asignacion ;
asignacion  = IDENT "=" asignacion | o_logico ;                   (* derecha *)
o_logico    = y_logico { "||" y_logico } ;
y_logico    = igualdad { "&&" igualdad } ;
igualdad    = comparacion { ( "==" | "!=" ) comparacion } ;
comparacion = suma { ( "<" | ">" | "<=" | ">=" ) suma } ;
suma        = producto { ( "+" | "-" ) producto } ;
producto    = unario { ( "*" | "/" | "%" ) unario } ;
unario      = ( "-" | "!" ) unario | potencia ;
potencia    = postfijo [ "**" unario ] ;                          (* derecha *)
postfijo    = primario { "(" [ lista ] ")" | "[" expresion "]" } ;
primario    = INT | STRING | "online" | "offline" | IDENT | "(" expresion ")"
            | "[" [ lista ] "]" | "{" [ par { "," par } [ "," ] ] "}"
            | scan | netrun | ping | quickhack ;
par         = expresion ":" expresion ;
lista       = expresion { "," expresion } ;

scan        = "scan" "(" expresion ")" bloque [ "backdoor" ( bloque | scan ) ] ;
netrun      = "netrun" "(" expresion ")" bloque ;
ping        = "ping" "(" ( "choom" IDENT "=" expresion | expresion ) ";"
              expresion ";" expresion ")" bloque ;
quickhack   = "quickhack" "(" [ IDENT { "," IDENT } ] ")" bloque ;

(* Léxico. letra = cualquier letra Unicode o "_"; los comentarios van de // al fin de línea *)
IDENT       = letra { letra | digito } ;
INT         = digito { digito } ;
STRING      = '"' { caracter | "\" escape } '"' | "'" { caracter | "\" escape } "'" ;
escape      = "n" | "t" | '"' | "'" | "\" ;
```

**Relación con el parser.** Cada nivel de la gramática es un valor del `enum Precedence` de `parser.ts`. En vez de una función por nivel, el parser Pratt usa una sola, `parseExpression(precedencia)`, que sigue tomando operadores mientras el siguiente tenga más precedencia que el contexto. Usar la misma precedencia para el lado derecho da asociatividad a la izquierda. Para `**` se usa un nivel menos y para `=` se usa `LOWEST`, por eso ambos asocian a la derecha.

## 3. Decisiones de diseño

1. **Palabras reservadas por significado:** `choom` (compañero que guarda un valor), `quickhack` (programa que se aplica a unos objetivos), `delta` (largarse con un valor), `scan` (revisar antes de actuar), `backdoor` (entrada alterna), `netrun` (sesión que sigue mientras dure), `ping` (recorrer nodo por nodo) y `online`/`offline`. Están en una sola tabla de `token.ts`.
2. **Errores por etapa:** el lexer reporta `[GLITCH]` y devuelve un token `ILLEGAL` que el parser no vuelve a reportar. El parser reporta `[BREACH FALLIDO]` y se detiene en el primer error para evitar errores en cascada. `interpret()` muestra solo la primera etapa que falla, y con errores léxicos o sintácticos el programa no se ejecuta.
3. **Errores de ejecución como valores:** un `ErrorObj` (`[FLATLINE]`) se devuelve hacia arriba, no se lanza. `Eval` le asigna la posición del primer nodo que lo ve, que es donde se originó; por eso un error dentro de un quickhack apunta a su cuerpo. La recursión infinita agota la pila de JS: `interpret()` captura el `RangeError` y lo convierte en un `FLATLINE`.
4. **`delta`:** envuelve su valor en un `ReturnValue` que atraviesa bloques y ciclos hasta que `applyFunction` lo desenvuelve.
5. **Ámbitos léxicos y closures:** solo los quickhacks crean ámbito. El `outer` de ese ámbito es el entorno donde el quickhack se **definió**, no donde se llama, y eso es lo que hace funcionar los closures. `choom` declara en el ámbito actual y tapa a una variable exterior. `=` modifica la variable en el ámbito más cercano donde existe, y es un error si no se declaró.
6. **Sin conversiones implícitas:** `1 + "1"` es un error; para convertir están `str()` e `int()`. Solo `offline` y `null` son falsos. `&&` y `||` evalúan en cortocircuito y devuelven `online`/`offline`.
7. **Enteros verificados:** los enteros usan `number` de JS y un resultado fuera de ±2⁵³ es un error en vez de perder precisión. `/` es división entera.
8. **Estructuras inmutables:** `push` y `rest` devuelven arreglos nuevos. Los hashes usan un `Map` por `hashKey()`, que incluye el tipo para que `1` y `"1"` no choquen.

## 4. Limitaciones conocidas

- Solo hay enteros: `3.5` produce un error léxico en el `.`.
- No hay asignación por índice (`lista[0] = x`) ni forma de modificar un hash existente.
- No existen `break`, `continue` ni un literal `null`; `delta` siempre lleva un valor.
- Comparar valores de distinto tipo con `==` es un error, no `offline`.
- Las cadenas no pueden ocupar varias líneas, y solo se reporta el primer error sintáctico.
- La profundidad de recursión está limitada por la pila de Node.js (varios miles de llamadas).

## 5. Uso de inteligencia artificial

Usamos **Claude (Anthropic)** como asistente para: revisar el proyecto contra el enunciado y detectar lo que faltaba (operadores lógicos, lectura de archivos, posiciones en los errores, un `for` real, el desbordamiento de pila); implementar esas correcciones; aplicar la temática, cuyas palabras eligió el equipo entre las opciones propuestas; y escribir las pruebas, los ejemplos y un primer borrador de la documentación.

Para verificar el código: corrimos `npm test` (67 pruebas; las salidas esperadas de `tests/cases/`, incluidas líneas y columnas, se calcularon a mano), comprobamos que `npm run typecheck` pase sin errores, ejecutamos los ejemplos y el REPL, y revisamos el código en equipo en la rama `tematica-cyberpunk` antes de integrarla a `main`.
