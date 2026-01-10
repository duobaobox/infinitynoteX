import { describe, it, expect, vi } from 'vitest';
import { createProxy, IpcInvoker } from '../ipcProxy';

describe('createProxy', () => {
  it('should forward method calls to invoke with prefix', () => {
    // Mock Invoker
    const invoke = vi.fn();
    const invoker: IpcInvoker = { invoke: invoke as unknown as IpcInvoker['invoke'] };

    // Create Proxy with explicit method list
    const proxy = createProxy<any>(invoker, 'test', ['foo']); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Call method
    proxy.foo('arg1', 123);

    // Verify invoke was called correctly
    expect(invoke).toHaveBeenCalledWith('test:foo', 'arg1', 123);
  });

  it('should use overrides if provided', () => {
    const invoke = vi.fn();
    const invoker: IpcInvoker = { invoke: invoke as unknown as IpcInvoker['invoke'] };
    const overrideFn = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proxy = createProxy<any>(invoker, 'test', ['baz'], {
      bar: overrideFn, // override
    });

    // Call overridden method
    proxy.bar('arg2');
    // Call method from methods list
    proxy.baz('arg3');

    // Verify behavior
    expect(overrideFn).toHaveBeenCalledWith('arg2');
    expect(invoke).not.toHaveBeenCalledWith('test:bar', expect.anything());
    expect(invoke).toHaveBeenCalledWith('test:baz', 'arg3');
  });
});
