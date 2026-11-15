import Task from "./Task";
import logger from "../../lib/logger";

export default class ProcessTask extends Task {

    // 任务类型
    public type: symbol = Task.TYPE.PROCESS;

    // 启动任务
    public start(): void {
        super.start();
        this.process()
            .then((result): void => this._emitCompleted(result))
            .catch((err): boolean | void => this._emitError(err));
    }

    // 处理
    public async process(): Promise<unknown> {
        logger.warn("Process task nothing to do...");
        return null;
    }

}
