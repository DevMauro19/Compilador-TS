// ast/ast.ts
// Nodos del árbol de sintaxis abstracta (AST) que construye el parser y recorre el evaluador.
// Cada nodo guarda el token que lo originó: de ahí salen la línea y la columna de los errores.
// toString() reconstruye el código con paréntesis explícitos; los tests lo usan para
// comprobar la precedencia (por ejemplo "1 + 2 * 3" → "(1 + (2 * 3))").
import { Token } from "../token/token.ts";

// ---------- Interfaces base ----------
export interface Node {
  tokenLiteral(): string;
  toString(): string;
}

// El campo "kind" cumple el mismo rol que statementNode()/expressionNode() en Go:
// impide que el compilador de TS confunda una sentencia con una expresión.
export interface Statement extends Node {
  readonly kind: "statement";
  readonly token: Token;
}

export interface Expression extends Node {
  readonly kind: "expression";
  readonly token: Token;
}

// ---------- Program ----------
// Raíz del árbol: la lista de sentencias del archivo o de la línea del REPL.
export class Program implements Node {
  statements: Statement[] = [];

  tokenLiteral(): string {
    return this.statements.length > 0 ? this.statements[0].tokenLiteral() : "";
  }

  toString(): string {
    return this.statements.map((s) => s.toString()).join("");
  }
}

// ---------- Sentencias ----------
// choom <nombre> = <valor>;
export class LetStatement implements Statement {
  readonly kind = "statement" as const;
  constructor(
    public token: Token,
    public name: Identifier,
    public value: Expression
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `${this.tokenLiteral()} ${this.name} = ${this.value};`; }
}

// delta <valor>;
export class ReturnStatement implements Statement {
  readonly kind = "statement" as const;
  constructor(public token: Token, public returnValue: Expression) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `${this.tokenLiteral()} ${this.returnValue};`; }
}

// Una expresión usada como sentencia, por ejemplo "holo(x);" o "x = x + 1;".
export class ExpressionStatement implements Statement {
  readonly kind = "statement" as const;
  constructor(public token: Token, public expression: Expression) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return this.expression.toString(); }
}

// { sentencia* }: cuerpo de scan, backdoor, netrun, ping y quickhack.
export class BlockStatement implements Statement {
  readonly kind = "statement" as const;
  constructor(public token: Token, public statements: Statement[] = []) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return this.statements.map((s) => s.toString()).join(""); }
}

// ---------- Literales ----------
export class Identifier implements Expression {
  readonly kind = "expression" as const;
  constructor(public token: Token, public value: string) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return this.value; }
}

export class IntegerLiteral implements Expression {
  readonly kind = "expression" as const;
  // number pierde precisión por encima de 2^53; el parser rechaza enteros más grandes
  constructor(public token: Token, public value: number) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return this.token.literal; }
}

// online / offline
export class BooleanLiteral implements Expression {
  readonly kind = "expression" as const;
  constructor(public token: Token, public value: boolean) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return this.token.literal; }
}

export class StringLiteral implements Expression {
  readonly kind = "expression" as const;
  constructor(public token: Token, public value: string) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `"${this.value}"`; }
}

// [a, b, c]
export class ArrayLiteral implements Expression {
  readonly kind = "expression" as const;
  constructor(public token: Token, public elements: Expression[] = []) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `[${this.elements.map((e) => e.toString()).join(", ")}]`; }
}

// {clave: valor, ...}
export class HashLiteral implements Expression {
  readonly kind = "expression" as const;
  constructor(public token: Token, public pairs: Array<[Expression, Expression]> = []) {}

  tokenLiteral() { return this.token.literal; }
  toString() {
    return `{${this.pairs
      .map(([key, value]) => `${key.toString()}: ${value.toString()}`)
      .join(", ")}}`;
  }
}

// ---------- Operadores ----------
// izquierda <operador> derecha. También representa && y ||, que el evaluador trata en cortocircuito.
export class InfixExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public left: Expression,
    public operator: string,
    public right: Expression
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.left} ${this.operator} ${this.right})`; }
}

// -x  o  !x
export class PrefixExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public operator: string,
    public right: Expression
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.operator}${this.right})`; }
}

// nombre = valor (sobre una variable ya declarada con choom)
export class AssignExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public name: Identifier,
    public value: Expression
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.name} = ${this.value})`; }
}

// coleccion[indice]
export class IndexExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public left: Expression,
    public index: Expression
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.left}[${this.index}])`; }
}

// ---------- Control de flujo ----------
// scan (condición) { ... } backdoor { ... }
// Un "backdoor scan" se guarda como un IfExpression dentro del bloque alternativo.
export class IfExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public condition: Expression,
    public consequence: BlockStatement,
    public alternative: BlockStatement | null = null
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() {
    let out = `${this.tokenLiteral()}${this.condition} ${this.consequence}`;
    if (this.alternative) out += ` backdoor ${this.alternative}`;
    return out;
  }
}

// netrun (condición) { ... }
export class WhileExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public condition: Expression,
    public body: BlockStatement
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `${this.tokenLiteral()}${this.condition} ${this.body}`; }
}

// ping (inicialización; condición; actualización) { ... }
export class ForExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public init: LetStatement | ExpressionStatement,
    public condition: Expression,
    public update: Expression,
    public body: BlockStatement
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() {
    const init = this.init.toString().replace(/;$/, "");
    return `${this.tokenLiteral()}(${init}; ${this.condition}; ${this.update}) ${this.body}`;
  }
}

// ---------- Funciones ----------
// quickhack(parámetros) { cuerpo }
export class FunctionLiteral implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public parameters: Identifier[],
    public body: BlockStatement
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() {
    const params = this.parameters.map((p) => p.toString()).join(", ");
    return `${this.tokenLiteral()}(${params}) ${this.body}`;
  }
}

// funcion(argumentos)
export class CallExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public func: Expression, // "function" es palabra reservada en JS/TS
    public args: Expression[] = []
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() {
    return `${this.func}(${this.args.map((a) => a.toString()).join(", ")})`;
  }
}
