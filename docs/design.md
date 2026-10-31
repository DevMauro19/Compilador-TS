# Diseño del intérprete AgenteTs

AgenteTs implementa un intérprete mínimo orientado al aprendizaje de compiladores. El flujo principal es: fuente → lexer → parser → AST → evaluator → resultado o error.

## 1. Lexer
El lexer recorre la cadena de entrada y genera tokens con tipo y literal. Reconoce identificadores, números enteros, cadenas, operadores, delimitadores y palabras reservadas (`let`, `if`, `else`, `while`, `for`, `fn`, `return`, `true`, `false`).

## 2. Parser Pratt
El parser resuelve expresiones con precedencia y asociatividad. Además de operadores infijos y prefijos, soporta llamadas a función, asignación, arreglos, hashes e indexación. La construcción del AST separa la sintaxis del comportamiento y facilita la evaluación.

## 3. AST
El AST modela nodos para sentencias y expresiones, como `LetStatement`, `IfExpression`, `FunctionLiteral`, `CallExpression`, `ArrayLiteral` y `HashLiteral`. Cada nodo expone una representación legible y permite que el evaluador recorra el árbol de manera recursiva.

## 4. Evaluador
El evaluador recibe cualquier nodo del AST y devuelve un objeto del lenguaje, no un valor nativo de JavaScript. Estas clases representan el valor ejecutable: `Integer`, `Bool`, `StringObj`, `ArrayObj`, `HashObj`, `FunctionObj`, `BuiltinObj`, `Null`, `ReturnValue` y `ErrorObj`.

El entorno (`Environment`) guarda variables por alcance. Las funciones capturan el entorno de definición para implementar closures. Los retornos y errores se propagan sin ejecutar el resto del bloque.

## 5. Error handling
Los errores se representan como objetos del lenguaje y se muestran con mensajes legibles, por ejemplo: “identificador no definido: x” o “división por cero”. Esto evita que la ejecución termine abruptamente y permite informar al usuario con claridad.

## 6. Validación
El proyecto incluye pruebas automáticas para evaluar el lexer, la evaluación de arreglos, hashes, builtins y recursión. La validación por línea de comando ejecuta el conjunto de pruebas y se puede lanzar con `npm test`.
