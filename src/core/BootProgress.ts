export const BOOT_TASKS=[['renderer','初始化 Three.js 渲染器'],['track','构建立体赛道与城市布局'],['city','加载全图城市与建筑'],['racers','加载玩家与四名 AI'],['textures','上传材质与贴图'],['effects','初始化水面与特效'],['reflection','生成城市环境反射'],['shaders','预热必要的 Shader'],['scene','准备比赛场景']] as const;
export type BootTask=typeof BOOT_TASKS[number][0];
/** Progress counts completed real tasks, not elapsed time or invented byte totals. */
export class BootProgress {
 readonly completed=new Set<BootTask>();
 readonly log:{task:BootTask;elapsedMs:number;percent:number}[]=[];
 constructor(private start=performance.now()){}
 get percent(){return Math.floor(this.completed.size/BOOT_TASKS.length*100);}
 complete(task:BootTask){if(this.completed.has(task))return;this.completed.add(task);this.log.push({task,elapsedMs:performance.now()-this.start,percent:this.percent});}
}
