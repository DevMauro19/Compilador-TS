# 🧠 AgenteTs

> **Un intérprete en desarrollo escrito completamente en TypeScript.**

AgenteTs es un proyecto educativo orientado a explorar cómo funciona un lenguaje de programación desde sus componentes fundamentales: **lexer → parser → AST → evaluación**.

Actualmente, el proyecto permite tomar código fuente, analizarlo sintácticamente y construir su **Árbol de Sintaxis Abstracta (AST)** mediante un **parser Pratt**. La evaluación del código todavía se encuentra en desarrollo.

---

## 🚧 Estado del proyecto

**AgenteTs se encuentra actualmente en desarrollo.**

| Componente            | Estado           |
| --------------------- | ---------------- |
| 🔤 Lexer              | ✅ Implementado   |
| 🌳 AST                | ✅ Implementado   |
| 🧩 Parser Pratt       | ✅ Implementado   |
| 💻 REPL               | ✅ Implementado   |
| 📦 Objetos / Entornos | 🚧 En desarrollo |
| ⚙️ Evaluador          | ⏳ Pendiente      |
| 🧪 Tests              | 🚧 En desarrollo |

El objetivo final es convertir AgenteTs en un pequeño lenguaje interpretado capaz de **leer, analizar y ejecutar código**.

---

# 🏗️ Arquitectura

El flujo principal del intérprete sigue el proceso clásico de un lenguaje:

```text
                    Código fuente
                         │
                         ▼
                    ┌─────────┐
                    │  Lexer  │
                    └────┬────┘
                         │
                         ▼
                       Tokens
                         │
                         ▼
                   ┌──────────┐
                   │  Parser  │
                   │   Pratt  │
                   └────┬─────┘
                        │
                        ▼
                       AST
                        │
                        ▼
                 ┌─────────────┐
                 │  Evaluador  │
                 │   (futuro)  │
                 └──────┬──────┘
                        │
                        ▼
                      Resultado
```

La idea es separar cada responsabilidad para que el intérprete pueda crecer progresivamente sin mezclar el análisis sintáctico con la ejecución.

---

# 📁 Estructura del proyecto

```text
AgenteTs/
│
├── ast/
│   └── ast.ts
│
├── lexer/
│   └── lexer.ts
│
├── object/
│   └── ...
│
├── parser/
│   └── parser.ts
│
├── repl/
│   └── repl.ts
│
├── token/
│   └── token.ts
│
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

### 🔤 `token/`

Define los diferentes tipos de tokens que reconoce el lenguaje.

También contiene el reconocimiento de palabras reservadas como:

```text
let
return
if
else
while
for
fn
true
false
```

---

### 🔎 `lexer/`

Se encarga de recorrer el código fuente y convertirlo en una secuencia de tokens.

Por ejemplo:

```text
let x = 10;
```

se transforma conceptualmente en:

```text
LET
IDENTIFIER
ASSIGN
INTEGER
SEMICOLON
```

---

### 🌳 `ast/`

Contiene los nodos que representan el **Árbol de Sintaxis Abstracta**.

El AST permite representar la estructura del programa independientemente de cómo fue escrito originalmente.

Por ejemplo:

```text
2 + 3 * 4
```

se representa respetando la precedencia:

```text
      +
     / \
    2   *
       / \
      3   4
```

---

### 🧩 `parser/`

Construye el AST a partir de los tokens generados por el lexer.

El proyecto utiliza un **Pratt Parser**, lo que permite manejar de forma elegante expresiones con diferentes niveles de precedencia.

Entre otras cosas, el parser reconoce:

* Expresiones prefijas.
* Expresiones infijas.
* Operadores de comparación.
* Asignaciones.
* Llamadas a funciones.
* Funciones anónimas.
* Declaraciones `let`.
* Declaraciones `return`.
* Expresiones condicionales.
* Bucles `while`.
* Bucles `for`.

---

### 📦 `object/`

Contiene la estructura prevista para representar los valores internos del lenguaje.

Esta parte será utilizada posteriormente por el evaluador para convertir expresiones del AST en valores que puedan ser manipulados durante la ejecución.

También contempla la construcción de **entornos**, necesarios para manejar variables y su alcance.

---

### 💻 `repl/`

Implementa el **REPL (Read-Eval-Print Loop)**.

Actualmente permite introducir expresiones y visualizar el resultado del análisis sintáctico.

```text
> let x = 2 + 3 * 4;
...
```

En futuras versiones, el REPL será capaz de ejecutar las expresiones y mostrar sus resultados.

---

# ✨ Sintaxis disponible

El parser actualmente soporta diferentes construcciones del lenguaje.

## Variables

```text
let x = 10;
let nombre = true;
```

## Operaciones

```text
2 + 3 * 4;
10 - 5;
20 / 4;
2 ** 3;
```

## Comparaciones

```text
x > 10;
x >= 10;
x == 10;
x != 5;
```

## Valores booleanos

```text
true;
false;
```

## Funciones

```text
let cuadrado = fn(n) {
    n ** 2
};
```

## Llamadas a funciones

```text
cuadrado(5);
```

## Condicionales

```text
if (x >= 10) {
    true
} else {
    false
}
```

## `while`

```text
while (x < 10) {
    x = x + 1;
}
```

## `for`

```text
for (let i = 0; i < 10; i = i + 1) {
    i;
}
```

---

# 🧪 Ejemplo completo

Un ejemplo que combina varias de las características disponibles:

```text
let x = 2 + 3 * 4;

let cuadrado = fn(n) {
    n ** 2
};

cuadrado(x);

if (x >= 10) {
    true
} else {
    false
}
```

Actualmente, AgenteTs **analiza estas instrucciones y construye su AST**, pero todavía no ejecuta las operaciones.

---

# 🛠️ Tecnologías

* **TypeScript**
* **Node.js**
* **npm**
* **Pratt Parser**
* **AST**
* **REPL**

---

# 🚀 Próximos pasos

El desarrollo del proyecto está orientado hacia la implementación progresiva de un intérprete funcional.

### ⚙️ Evaluador

Implementar el componente encargado de recorrer el AST y producir resultados.

```text
AST
 │
 ▼
Evaluator
 │
 ▼
Object
 │
 ▼
Resultado
```

### 📦 Sistema de objetos

Completar los objetos internos necesarios para representar:

* Enteros.
* Booleanos.
* Nulos.
* Funciones.
* Errores.
* Entornos.

### 🔐 Manejo de errores

Mejorar los mensajes producidos ante errores:

```text
Error sintáctico
Error de evaluación
Variable inexistente
Operación inválida
```

### 🧪 Pruebas

Agregar pruebas automatizadas para validar:

* Lexer.
* Parser.
* Precedencia de operadores.
* AST.
* Evaluador.
* Funciones.
* Variables y entornos.

---

# 🎯 Objetivo

El objetivo de AgenteTs no es solamente crear otro lenguaje, sino **entender cómo funciona un intérprete desde dentro**.

El proyecto busca recorrer todo el camino:

```text
Código
  ↓
Tokens
  ↓
AST
  ↓
Evaluación
  ↓
Resultado
```

Cada componente representa una pieza fundamental en la construcción de un lenguaje de programación.

---

## 📚 Motivación

AgenteTs está desarrollado como un proyecto de aprendizaje y experimentación con **compiladores, intérpretes, estructuras de datos y TypeScript**.

El proyecto se encuentra en evolución y nuevas características serán incorporadas progresivamente.

> 🐱 **Del código al AST, y del AST a la ejecución.**
>
> **AgenteTs — construyendo un intérprete, pieza por pieza.**
