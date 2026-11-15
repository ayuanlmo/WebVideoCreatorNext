import assert from "assert";
import _ from "lodash";

import {TRANSITION} from "../lib/const";

const TRANSITION_IDS: string[] = Object.values(TRANSITION);

// 转场选项
export interface ITransitionOptions {
    id?: string; // 转场ID
    duration?: number; // 转场时长（毫秒），默认500
}

export default class Transition {

    public id: string; // 转场ID
    public duration: number; // 转场时长

    // 构造函数
    constructor(options: ITransitionOptions) {
        assert(_.isObject(options), "Transition options must be Object");
        const {id, duration} = options;
        assert(_.isString(id), "Transition id must be string");
        assert(TRANSITION_IDS.includes(id), `Transition id ${id} may not be supported, please refer to http://trac.ffmpeg.org/wiki/Xfade`);
        assert(_.isUndefined(duration) || _.isNumber(duration), "Transition duration must be number");
        this.id = id;
        this.duration = _.defaultTo(duration, 500);
    }

}
