// evaluator/evaluator.ts
// Este módulo traduce el AST del lenguaje a valores ejecutables del entorno.
// La idea es la misma que en el evaluator.go original: cada nodo devuelve un
// objeto del lenguaje (Integer, Bool, Error, ReturnValue, etc.) y se propagan
// los errores y los retornos sin seguir ejecutando el resto del bloque.

import {
  type Expression,
  type Node,
  ArrayLiteral,
  AssignExpression,
  BlockStatement,
  BooleanLiteral,
  CallExpression,
  ExpressionStatement,
  ForExpression,
  FunctionLiteral,
  HashLiteral,
  Identifier,
  IfExpression,
  IndexExpression,
  InfixExpression,
  IntegerLiteral,
  LetStatement,
  PrefixExpression,
  Program,
  ReturnStatement,
  StringLiteral,
  WhileExpression,
} from "../ast/ast.ts";
import {
  ArrayObj,
  Bool,
  BuiltinObj,
  Environment,
  ErrorObj,
  FALSE,
  FunctionObj,
  HashObj,
  Integer,
  LangObject,
  NULL,
  Null,
  ObjectTypes,
  ReturnValue,
  StringObj,
  TRUE,
} from "../object/object.ts";

// Punto de entrada para evaluar cualquier nodo del AST.
// Si el valor recibido es un nodo completo del programa, se reduce a su último
// resultado en ejecución (o al primer error/return encontrado).
export function Eval(node: Node | null, env: Environment): LangObject {
  if (node === null) {
    return new ErrorObj("nodo incompleto del AST");
  }

  if (node instanceof Program) {
    return evalProgram(node.statements, env);
  }

  if (node instanceof BlockStatement) {
    return evalBlock(node.statements, env);
  }

  if (node instanceof ExpressionStatement) {
    return Eval(node.expression, env);
  }

  if (node instanceof LetStatement) {
    const value = Eval(node.value, env);
    if (isError(value)) {
      return value;
    }
    env.set(node.name.value, value);
    return NULL;
  }

  if (node instanceof ReturnStatement) {
    const value = Eval(node.returnValue, env);
    if (isError(value)) {
      return value;
    }
    return new ReturnValue(value);
  }

  if (node instanceof IntegerLiteral) {
    return new Integer(node.value);
  }

  if (node instanceof BooleanLiteral) {
    return node.value ? TRUE : FALSE;
  }

  if (node instanceof StringLiteral) {
    return new StringObj(node.value);
  }

  if (node instanceof ArrayLiteral) {
    const elements = evalExpressions(node.elements, env);
    if (isError(elements)) {
      return elements;
    }
    return new ArrayObj(elements);
  }

  if (node instanceof HashLiteral) {
    return evalHash(node, env);
  }

  if (node instanceof Identifier) {
    const value = env.get(node.value);
    if (value !== undefined) {
      return value;
    }
    return new ErrorObj(`identificador no definido: ${node.value}`);
  }

  if (node instanceof PrefixExpression) {
    const right = Eval(node.right, env);
    if (isError(right)) {
      return right;
    }
    return evalPrefix(node.operator, right);
  }

  if (node instanceof InfixExpression) {
    const left = Eval(node.left, env);
    if (isError(left)) {
      return left;
    }

    const right = Eval(node.right, env);
    if (isError(right)) {
      return right;
    }

    return evalInfix(node.operator, left, right);
  }

  if (node instanceof AssignExpression) {
    return evalAssign(node, env);
  }

  if (node instanceof IfExpression) {
    const condition = Eval(node.condition, env);
    if (isError(condition)) {
      return condition;
    }

    if (truthy(condition)) {
      return Eval(node.consequence, env);
    }

    if (node.alternative !== null) {
      return Eval(node.alternative, env);
    }

    return NULL;
  }

  if (node instanceof WhileExpression) {
    return evalWhile(node, env);
  }

  if (node instanceof ForExpression) {
    return evalFor(node, env);
  }

  if (node instanceof FunctionLiteral) {
    return new FunctionObj(node.parameters, node.body, env);
  }

  if (node instanceof CallExpression) {
    const fn = Eval(node.func, env);
    if (isError(fn)) {
      return fn;
    }

    const args = evalExpressions(node.args, env);
    if (isError(args)) {
      return args;
    }

    return applyFunction(fn, args);
  }

  if (node instanceof IndexExpression) {
    const left = Eval(node.left, env);
    if (isError(left)) {
      return left;
    }

    const index = Eval(node.index, env);
    if (isError(index)) {
      return index;
    }

    return evalIndex(left, index);
  }

  return new ErrorObj(`nodo no soportado: ${node.constructor.name}`);
}

function evalProgram(statements: any[], env: Environment): LangObject {
  let result: LangObject = NULL;

  for (const statement of statements) {
    result = Eval(statement, env);

    if (result instanceof ReturnValue) {
      return result.value;
    }

    if (isError(result)) {
      return result;
    }
  }

  return result;
}

function evalBlock(statements: any[], env: Environment): LangObject {
  let result: LangObject = NULL;

  for (const statement of statements) {
    result = Eval(statement, env);

    if (result instanceof ReturnValue || isError(result)) {
      return result;
    }
  }

  return result;
}

// En este intérprete, sólo false y null son falsy.
// Los valores 0, "" y los objetos vacíos se comportan como verdaderos.
function truthy(value: LangObject): boolean {
  if (value === NULL) {
    return false;
  }

  if (value instanceof Bool) {
    return value.value;
  }

  return true;
}

function evalPrefix(operator: string, right: LangObject): LangObject {
  switch (operator) {
    case "!":
      return truthy(right) ? FALSE : TRUE;
    case "-": {
      if (!(right instanceof Integer)) {
        return new ErrorObj(`operador - no admite ${right.type()}`);
      }

      if (!Number.isSafeInteger(-right.value)) {
        return new ErrorObj(`desbordamiento al negar ${right.value}`);
      }

      return new Integer(-right.value);
    }
    default:
      return new ErrorObj(`operador prefijo desconocido: ${operator}`);
  }
}

function evalInfix(operator: string, left: LangObject, right: LangObject): LangObject {
  if (left.type() !== right.type()) {
    return new ErrorObj(`tipos incompatibles: ${left.type()} ${operator} ${right.type()}`);
  }

  if (left instanceof Integer && right instanceof Integer) {
    switch (operator) {
      case "+":
        return checkedInteger(left.value + right.value);
      case "-":
        return checkedInteger(left.value - right.value);
      case "*":
        return checkedInteger(left.value * right.value);
      case "/":
        if (right.value === 0) {
          return new ErrorObj("división por cero");
        }
        return checkedInteger(Math.trunc(left.value / right.value));
      case "%":
        if (right.value === 0) {
          return new ErrorObj("módulo por cero");
        }
        return checkedInteger(left.value % right.value);
      case "**":
        if (right.value < 0) {
          return new ErrorObj(`exponente negativo: ${right.value}`);
        }
        if (!Number.isSafeInteger(Math.pow(left.value, right.value))) {
          return new ErrorObj("desbordamiento de entero");
        }
        return checkedInteger(Math.pow(left.value, right.value));
      case "<":
        return left.value < right.value ? TRUE : FALSE;
      case ">":
        return left.value > right.value ? TRUE : FALSE;
      case "<=":
        return left.value <= right.value ? TRUE : FALSE;
      case ">=":
        return left.value >= right.value ? TRUE : FALSE;
      case "==":
        return left.value === right.value ? TRUE : FALSE;
      case "!=":
        return left.value !== right.value ? TRUE : FALSE;
      default:
        break;
    }
  }

  if (left instanceof Bool && right instanceof Bool) {
    switch (operator) {
      case "==":
        return left.value === right.value ? TRUE : FALSE;
      case "!=":
        return left.value !== right.value ? TRUE : FALSE;
      default:
        break;
    }
  }

  if (left instanceof StringObj && right instanceof StringObj) {
    switch (operator) {
      case "+":
        return new StringObj(left.value + right.value);
      case "==":
        return left.value === right.value ? TRUE : FALSE;
      case "!=":
        return left.value !== right.value ? TRUE : FALSE;
      default:
        break;
    }
  }

  if (operator === "==") {
    return left === right ? TRUE : FALSE;
  }

  if (operator === "!=") {
    return left !== right ? TRUE : FALSE;
  }

  return new ErrorObj(`operador no admitido: ${left.type()} ${operator} ${right.type()}`);
}

function checkedInteger(value: number): LangObject {
  if (!Number.isSafeInteger(value)) {
    return new ErrorObj("desbordamiento de entero");
  }
  return new Integer(value);
}

function evalHash(node: HashLiteral, env: Environment): LangObject {
  const pairs: Array<{ key: { hashKey: () => any; inspect: () => string }; value: LangObject }> = [];

  for (const [keyNode, valueNode] of node.pairs) {
    const key = Eval(keyNode, env);
    if (isError(key)) {
      return key;
    }
    const value = Eval(valueNode, env);
    if (isError(value)) {
      return value;
    }

    if (!(key instanceof StringObj || key instanceof Integer || key instanceof Bool)) {
      return new ErrorObj(`tipo no hashable: ${key.type()}`);
    }

    pairs.push({ key: key as { hashKey: () => any; inspect: () => string }, value });
  }

  return new HashObj(pairs as Array<{ key: any; value: LangObject }>);
}

function evalIndex(left: LangObject, index: LangObject): LangObject {
  if (left instanceof ArrayObj) {
    if (!(index instanceof Integer)) {
      return new ErrorObj(`índice no válido para arreglo: ${index.type()}`);
    }
    const idx = index.value;
    if (idx < 0 || idx >= left.elements.length) {
      return new ErrorObj(`índice fuera de rango: ${idx}`);
    }
    return left.elements[idx];
  }

  if (left instanceof HashObj) {
    if (!(index instanceof StringObj || index instanceof Integer || index instanceof Bool)) {
      return new ErrorObj(`tipo no hashable: ${index.type()}`);
    }
    return left.get(index) ?? NULL;
  }

  return new ErrorObj(`índice no soportado en ${left.type()}`);
}

function evalWhile(node: WhileExpression, env: Environment): LangObject {
  let result: LangObject = NULL;

  while (true) {
    const condition = Eval(node.condition, env);
    if (isError(condition)) {
      return condition;
    }

    if (!truthy(condition)) {
      return result;
    }

    result = Eval(node.body, env);
    if (result instanceof ReturnValue || isError(result)) {
      return result;
    }
  }
}

function evalFor(node: ForExpression, env: Environment): LangObject {
  let result: LangObject = NULL;

  while (true) {
    const condition = Eval(node.condition, env);
    if (isError(condition)) {
      return condition;
    }

    if (!truthy(condition)) {
      return result;
    }

    result = Eval(node.body, env);
    if (result instanceof ReturnValue || isError(result)) {
      return result;
    }
  }
}

function evalExpressions(expressions: Expression[], env: Environment): LangObject[] | ErrorObj {
  const results: LangObject[] = [];

  for (const expression of expressions) {
    const value = Eval(expression, env);
    if (isError(value)) {
      return value as ErrorObj;
    }
    results.push(value);
  }

  return results;
}

function applyFunction(fn: LangObject, args: LangObject[]): LangObject {
  if (fn instanceof BuiltinObj) {
    return fn.fn(...args);
  }

  if (!(fn instanceof FunctionObj)) {
    return new ErrorObj(`${fn.type()} no es una función`);
  }

  if (args.length !== fn.parameters.length) {
    return new ErrorObj(
      `cantidad de argumentos incorrecta: se esperaban ${fn.parameters.length}, llegaron ${args.length}`
    );
  }

  const local = Environment.enclosed(fn.env);

  for (let i = 0; i < fn.parameters.length; i += 1) {
    local.set(fn.parameters[i].value, args[i]);
  }

  const result = Eval(fn.body, local);
  if (result instanceof ReturnValue) {
    return result.value;
  }

  return result;
}

function evalAssign(node: AssignExpression, env: Environment): LangObject {
  if (!(node.name instanceof Identifier)) {
    return new ErrorObj("destino de asignación no admitido");
  }

  if (!env.has(node.name.value)) {
    return new ErrorObj(`identificador no definido: ${node.name.value}`);
  }

  const value = Eval(node.value, env);
  if (isError(value)) {
    return value;
  }

  env.assign(node.name.value, value);
  return value;
}

function isError(value: unknown): value is ErrorObj {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: () => string }).type === "function" &&
    (value as { type: () => string }).type() === ObjectTypes.ERROR
  );
}

export { isError };
export const evaluate = Eval;
export default Eval;
