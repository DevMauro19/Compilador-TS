import { Token } from "../token/token.ts";

// ---------- Interfaces base ----------
export interface Node {
  tokenLiteral(): string;
  toString(): string;
}

// Los campos "marcadores" cumplen el mismo rol que statementNode()/expressionNode()
export interface Statement extends Node {
  readonly kind: "statement";
}

export interface Expression extends Node {
  readonly kind: "expression";
}

// ---------- Program ----------
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
export class LetStatement implements Statement {
  readonly kind = "statement" as const;
  constructor(
    public token: Token,
    public name: Identifier,
    public value: Expression | null = null
  ) {}

  tokenLiteral() { return this.token.literal; }

  toString(): string {
    const val = this.value ? this.value.toString() : "";
    return `${this.tokenLiteral()} ${this.name} = ${val};`;
  }
}

export class ReturnStatement implements Statement {
  readonly kind = "statement" as const;
  constructor(public token: Token, public returnValue: Expression | null = null) {}

  tokenLiteral() { return this.token.literal; }

  toString(): string {
    return `${this.tokenLiteral()} ${this.returnValue?.toString() ?? ""};`;
  }
}

export class ExpressionStatement implements Statement {
  readonly kind = "statement" as const;
  constructor(public token: Token, public expression: Expression | null = null) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return this.expression?.toString() ?? ""; }
}

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
  // number pierde precisión por encima de 2^53; usa bigint si lo necesitas
  constructor(public token: Token, public value: number) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return this.token.literal; }
}

export class BooleanLiteral implements Expression {
  readonly kind = "expression" as const;
  constructor(public token: Token, public value: boolean) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return this.token.literal; }
}

// ---------- Operadores ----------
export class InfixExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public left: Expression,
    public operator: string,
    public right: Expression | null = null
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.left} ${this.operator} ${this.right})`; }
}

export class PrefixExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public operator: string,
    public right: Expression | null = null
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.operator}${this.right})`; }
}

export class AssignExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public name: Identifier,
    public value: Expression | null = null
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.name} = ${this.value})`; }
}

// ---------- Control de flujo ----------
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
    let out = `if${this.condition} ${this.consequence}`;
    if (this.alternative) out += ` else ${this.alternative}`;
    return out;
  }
}

export class WhileExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public condition: Expression,
    public body: BlockStatement
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `while${this.condition} ${this.body}`; }
}

export class ForExpression implements Expression {
  readonly kind = "expression" as const;
  constructor(
    public token: Token,
    public condition: Expression,
    public body: BlockStatement
  ) {}

  tokenLiteral() { return this.token.literal; }
  toString() { return `for${this.condition} ${this.body}`; }
}

// ---------- Funciones ----------
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