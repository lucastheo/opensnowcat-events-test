export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DivisionByZeroError extends BusinessError {
  constructor(message: string = 'Division by zero') {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnsupportedOperatorError extends BusinessError {
  constructor(operator: string) {
    super(`Unsupported operator: ${operator}`);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidTimezoneError extends BusinessError {
  constructor(timezone: string) {
    super(`Invalid timezone: ${timezone}`);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidDiceError extends BusinessError {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidBatchCountError extends BusinessError {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
