import genericPool from "generic-pool";

// generic-pool 通用辅助

// generic-pool 资源工厂接口
export interface IPoolFactory<T> {
    create: () => Promise<T>; // 创建资源
    destroy: (resource: T) => Promise<void> | void; // 销毁资源
    validate?: (resource: T) => boolean | Promise<boolean>; // 校验资源是否可用
}

// generic-pool 池选项（常用字段显式声明，其余透传）
export interface IPoolOptions {
    max?: number; // 池内资源最大数量
    min?: number; // 池内资源最小数量
    autostart?: boolean; // 是否自动启动池（WVC中固定为false，由warmup显式启动）
    // 其它generic-pool支持的选项
    [key: string]: unknown;
}

// generic-pool 池对象
export type TPool<T> = genericPool.Pool<T>;

interface IWaiter {
    settled: boolean;

    reject(error: unknown): void;

    resolve(resource: unknown): void;
}

const poolWaiters = new WeakMap<object, Set<IWaiter>>();

// 创建资源池
export function createPool<T>(factory: IPoolFactory<T>, options: IPoolOptions = {}): TPool<T> {
    // IPoolFactory/IPoolOptions 与 generic-pool 的 Factory/Options 形状等价，仅泛型签名不同
    const pool = genericPool.createPool(factory as unknown as genericPool.Factory<T>, options as unknown as genericPool.Options) as TPool<T>;
    const waiters = new Set<IWaiter>();
    poolWaiters.set(pool, waiters);
    const originalAcquire = pool.acquire.bind(pool);
    pool.acquire = (priority?: number): Promise<T> => {
        const waiter: IWaiter = {settled: false, reject: null, resolve: null};
        const promise = new Promise<T>((resolve, reject): void => {
            waiter.resolve = resolve;
            waiter.reject = reject;
            originalAcquire(priority).then(
                (resource): void => {
                    waiters.delete(waiter);
                    if (waiter.settled) {
                        // 等待者已被创建错误reject，迟到的资源直接销毁避免泄漏
                        Promise.resolve(pool.destroy(resource)).catch((): void => {
                        });
                        return;
                    }
                    waiter.settled = true;
                    resolve(resource);
                },
                (error): void => {
                    waiters.delete(waiter);
                    if (waiter.settled)
                        return;
                    waiter.settled = true;
                    reject(error);
                }
            );
        });
        waiters.add(waiter);
        return promise;
    };
    return pool;
}

// 转发工厂创建错误到等待中的客户端
export function forwardFactoryCreateError<T>(pool: TPool<T>, onError: (error: Error) => void): void {
    pool.on("factoryCreateError", (error: Error): void => {
        const waiters = poolWaiters.get(pool);
        const waiter = waiters && [...waiters].find((w): boolean => !w.settled);
        if (!waiter) {
            onError(error);
            return;
        }
        waiter.settled = true;
        waiters.delete(waiter);
        waiter.reject(error);
    });
}

// 等待池内可用资源达到min
// generic-pool的ready()只轮询不reject，且工厂创建失败后既不补建缺额也不报错，
// 浏览器/页面启动失败时会永久挂起（上游 issues/38）；这里主动补建缺额，创建错误超出预算即抛出供调用方捕获重试
export async function poolReady<T>(pool: TPool<T>, min: number, maxErrors = 3): Promise<void> {
    let errorCount = 0;
    let lastError: Error = null;
    const onCreateError = (error: Error): void => {
        errorCount++;
        lastError = error;
    };
    pool.on("factoryCreateError", onCreateError);
    try {
        while (pool.available < min) {
            if (errorCount >= maxErrors)
                throw lastError ?? new Error(`Pool warmup failed: available ${pool.available} < min ${min}`);
            // generic-pool仅在存在acquire等待者时经_dispense补建，创建失败留下的缺额需手动触发补建
            (pool as unknown as { _ensureMinimum(): void })._ensureMinimum();
            await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, 200));
        }
    } finally {
        pool.off("factoryCreateError", onCreateError);
    }
}