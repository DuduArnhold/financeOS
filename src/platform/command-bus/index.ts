import { PlatformCommand } from '../types'

export interface ICommandHandler<T extends PlatformCommand = PlatformCommand> {
  handle(command: T): Promise<void>;
}

export interface ICommandBus {
  register(commandType: string, handler: ICommandHandler): void;
  dispatch<T extends PlatformCommand>(command: T): Promise<void>;
}

class CommandBus implements ICommandBus {
  private handlers = new Map<string, ICommandHandler>()

  register(commandType: string, handler: ICommandHandler): void {
    if (this.handlers.has(commandType)) {
      console.warn(`CommandBus: overriding handler for command type "${commandType}"`)
    }
    this.handlers.set(commandType, handler)
  }

  async dispatch<T extends PlatformCommand>(command: T): Promise<void> {
    const handler = this.handlers.get(command.type)
    if (!handler) {
      throw new Error(`CommandBus: no handler registered for command type "${command.type}"`)
    }
    await handler.handle(command)
  }
}

export const commandBus: ICommandBus = new CommandBus()
