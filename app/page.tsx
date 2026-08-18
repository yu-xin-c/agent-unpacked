"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type ProjectKey = "dsh" | "pi" | "nanobot" | "claude" | "openclaw";
type RouteKey = "home" | ProjectKey | "compare";

type Lesson = {
  id: string;
  group: string;
  groupColor: string;
  title: string;
  kicker: string;
  motto: string;
  why: string;
  model: string;
  flow: string[];
  files: string[];
  code: string;
  points: string[];
  takeaway: string;
};

type LessonDetail = {
  architecture: string;
  evidence: Array<{
    file: string;
    symbol: string;
    note: string;
    lineStart?: number;
    lineEnd?: number;
    kind?: "代码事实" | "测试证据" | "架构推断";
  }>;
  trace?: Array<{
    name: string;
    input: string;
    responsibility: string;
    output: string;
    anchor: string;
  }>;
};

type CourseOverviewData = {
  eyebrow: string;
  headline: string;
  thesis: string;
  tension: string;
  principles: Array<{ title: string; detail: string }>;
  journey: string[];
  questions: Array<{ question: string; answer: string }>;
  bestFor: string[];
  tradeoffs: string[];
};

type LessonDrill = {
  failureTrigger: string;
  failureSymptom: string;
  debugPath: string;
  experiment: string;
  deliverable: string;
  reviewQuestion: string;
  reviewAnswer: string;
};

type SignatureDesign = {
  name: string;
  ordinary: string;
  choice: string;
  payoff: string;
  cost: string;
};

const nanobotLessons: Lesson[] = [
  {
    id: "N01",
    group: "消息地基",
    groupColor: "#4f8df7",
    title: "MessageBus 只负责传递，真正的并发语义在 Loop",
    kicker: "Envelope / Queue / Routing",
    motto: "两只 asyncio.Queue 建立边界；会话串行、跨会话并发和中途插话由 AgentLoop 解释。",
    why: "只读 queue.py 很容易把 MessageBus 误解成完整事件系统。它其实没有订阅、ack、优先级或背压策略；价值在于统一 InboundMessage / OutboundMessage。真正决定同一会话如何排队、活跃轮次如何接收 follow-up 的，是 AgentLoop。",
    model: "MessageBus 像两条传送带，信封格式统一但不会判断包裹归属；AgentLoop 才是分拣中心。",
    flow: ["Channel adapter", "InboundMessage.session_key", "inbound Queue", "per-session lock", "pending injection", "OutboundMessage"],
    files: ["nanobot/bus/events.py", "nanobot/bus/queue.py", "nanobot/agent/loop.py", "nanobot/channels/manager.py"],
    code: `# concept sketch：MessageBus 不拥有调度策略\ninbound.put(message)\nkey = effective_session_key(message)\nasync with session_lock[key]:\n    run_turn_or_inject(message)\noutbound.put(response)`,
    points: ["消息信封与调度策略分离", "同会话串行、跨会话并发", "活跃轮次有独立 pending queue"],
    takeaway: "nanobot 的消息边界很薄；理解并发时必须从 queue.py 继续追到 AgentLoop.run() 与 _dispatch()。",
  },
  {
    id: "N02",
    group: "消息地基",
    groupColor: "#4f8df7",
    title: "两层循环 + 七阶段 Turn：一次回复如何安全提交",
    kicker: "Dispatch / Stage / Checkpoint",
    motto: "Loop 管产品事务，Runner 管模型事务；checkpoint 让被取消的工具轮次仍可恢复。",
    why: "AgentLoop 不是一层薄壳。它先按 session 加锁，再依次执行 restore → compact → command → build → run → save → respond；Runner 内部才做 context governance、provider 请求、工具执行、注入和终止。工具前后还会写 runtime checkpoint，/stop 后可把部分结果物化回历史。",
    model: "外层像数据库事务协调器，内层像查询执行器：一个保证提交边界，一个推进具体计算。",
    flow: ["session lock", "restore", "compact", "build", "AgentRunner iterations", "save", "delivery"],
    files: ["nanobot/agent/loop.py", "nanobot/agent/runner.py", "nanobot/agent/turn_delivery.py"],
    code: `# concept sketch：源码中的真实阶段顺序\nfor stage in [restore, compact, command, build, run, save, respond]:\n    await stage(turn)\n\n# Runner 在工具前后写 checkpoint\nawait checkpoint("awaiting_tools")\nresults = await execute_tools()\nawait checkpoint("tools_completed")`,
    points: ["每 session 串行提交", "七阶段轮次管线", "工具边界 checkpoint 与取消恢复"],
    takeaway: "排障先判断失败发生在产品阶段还是模型迭代；两类问题的状态所有者不同。",
  },
  {
    id: "N03",
    group: "上下文装配",
    groupColor: "#25ad7c",
    title: "三次投影：持久历史不等于模型输入",
    kicker: "Build / Govern / Project",
    motto: "先从 Session 取合法后缀，再组装 system 与本轮输入，最后在发送前治理模型副本。",
    why: "ContextBuilder 负责身份、项目 AGENTS.md、Agent 自己的 SOUL/USER、长期记忆、技能和 recent history 的顺序；Session.get_history() 先剔除命令、修复合法 tool 边界并执行 token 尾切；ContextGovernor 又只对 model copy 清理 orphan tool result、回填缺失结果、离线大结果和压缩 inflight 内容，不改持久历史。",
    model: "档案库保存原件，编辑台挑选素材，播出审查只修改最终播出版。",
    flow: ["Session.messages", "legal replay suffix", "ContextBuilder", "runtime blocks", "ContextGovernor copy", "Provider request"],
    files: ["nanobot/session/manager.py", "nanobot/agent/context.py", "nanobot/agent/context_governance.py", "nanobot/runtime_context.py"],
    code: `# concept sketch：三个对象必须分开\nhistory = session.get_history(max_tokens=budget)\nmessages = builder.build_messages(history, current_input)\nmodel_messages = governor.prepare_for_model(messages.copy())\nawait provider.chat(model_messages)`,
    points: ["Agent 工作区与项目工作区分属不同来源", "历史先保持合法工具边界", "治理只改模型副本"],
    takeaway: "看见 prompt 过长或工具历史损坏时，不能只查 ContextBuilder；先确认问题属于存储、组装还是发送前治理。",
  },
  {
    id: "N04",
    group: "模型与工具",
    groupColor: "#a85ce5",
    title: "ProviderSnapshot：配置热变更只影响下一次准入",
    kicker: "Registry / Snapshot / Admission",
    motto: "Provider registry 解释配置，factory 构建快照，ModelRuntimeResolver 在下一轮 admission 才刷新。",
    why: "nanobot 不让一次正在运行的 turn 读取可变全局模型配置。ProviderSnapshot 冻结 provider、model、context window、signature 和 generation；配置 watcher 只 invalidate resolver，admit() 在下一轮创建不可变 LLMRuntime。ProviderConversationState 还作为私有记录保存，不混进公开 transcript。",
    model: "像机场放行：更新航班计划不会在飞机起飞后更换发动机，只影响下一架获准起飞的飞机。",
    flow: ["ProviderSpec", "factory validation", "ProviderSnapshot", "invalidate", "next-turn admit", "immutable LLMRuntime"],
    files: ["nanobot/providers/registry.py", "nanobot/providers/factory.py", "nanobot/agent/model_runtime.py", "nanobot/providers/base.py"],
    code: `# concept sketch：刷新发生在下一轮准入\nwatcher.on_change(resolver.invalidate)\nruntime = resolver.admit()  # immutable for this turn\nresult = await runner.run(runtime=runtime)`,
    points: ["metadata、构造与准入三层分工", "热配置不会撕裂运行中 turn", "provider 私有 continuation 独立持久化"],
    takeaway: "模型抽象的含金量不只在统一 API，还在于定义配置何时生效、私有协议状态存到哪里。",
  },
  {
    id: "N05",
    group: "模型与工具",
    groupColor: "#a85ce5",
    title: "工具调度器：顺序来自能力声明，而不是模型返回顺序",
    kicker: "Discovery / Validate / Batch",
    motto: "只让 concurrency_safe 工具相邻并发；写工具和 exclusive 工具独占批次。",
    why: "ToolLoader 扫描内置模块与 nanobot.tools entry point；ToolRegistry 精确匹配名称、归一化 arguments、类型转换并按 JSON Schema 校验。Runner 再按 Tool.concurrency_safe 把连续调用分批：安全只读工具可 gather，其他工具逐个执行。结果最终仍按原始调用顺序追加到 messages。",
    model: "仓库拣货可以并行，叉车进窄通道必须独占；调度规则由工位能力声明决定。",
    flow: ["module / entry point", "stable schemas", "prepare_call", "concurrency_safe partition", "execute", "ordered tool messages"],
    files: ["nanobot/agent/tools/loader.py", "nanobot/agent/tools/base.py", "nanobot/agent/tools/registry.py", "nanobot/agent/runner.py"],
    code: `# concept sketch：源码按连续区段分批\nfor batch in partition(calls, tool.concurrency_safe):\n    results += await gather(batch) if len(batch) > 1 else [await run(batch[0])]\nappend_tool_messages_in_call_order(results)`,
    points: ["内置与第三方工具统一发现", "执行前精确名称与 schema 校验", "只读并发、写入独占"],
    takeaway: "工具系统不仅是 registry；真正的可靠性来自 schema、错误语义、并发能力声明和有序回填共同组成的协议。",
  },
  {
    id: "N06",
    group: "持续上下文",
    groupColor: "#e69f2d",
    title: "Session 是原子重写的 JSONL，压缩推进游标而不删事实",
    kicker: "Durability / Legal Suffix / Cursor",
    motto: "磁盘文件保存完整消息与私有 provider state；last_consolidated 只标记已归档前缀。",
    why: "SessionStore 每次保存到随机临时文件，再 os.replace 原子发布；可选 fsync 同时刷文件与目录。长对话压缩不是覆盖 transcript：Consolidator 在用户轮次边界归档旧消息到 history.jsonl，推进 last_consolidated、清空不可复用 provider state，并保留合法近期后缀。LLM 失败时退化为 raw archive，避免静默丢失。",
    model: "总账保留原始凭证，归档游标只说明哪些页已经做过月结；当前桌面仍保留一段连续票据。",
    flow: ["Session.messages", "atomic JSONL save", "token estimate", "user-turn boundary", "history.jsonl archive", "last_consolidated", "recent legal replay"],
    files: ["nanobot/session/manager.py", "nanobot/agent/memory.py", "nanobot/agent/autocompact.py"],
    code: `# concept sketch：归档进度与事实存储分离\nsummary_or_raw = await archive(messages[cursor:boundary])\nsession.last_consolidated = boundary\nsession.provider_state = None\natomic_save(session)\nvisible = session.get_history()`,
    points: ["临时文件 + replace 原子发布", "压缩边界对齐用户 turn", "失败时 raw archive 后再推进游标"],
    takeaway: "nanobot 的 compaction 是归档进度和模型视图治理，不是把 JSONL 旧消息直接删掉。",
  },
  {
    id: "N07",
    group: "持续上下文",
    groupColor: "#e69f2d",
    title: "Dream 是受限的文件编辑事务，不是自动摘要字段",
    kicker: "Cursor / Restricted Tools / Git Audit",
    motto: "Dream 读取尚未处理的 history，拿到真实文件快照，只能编辑指定记忆文件与 skills；成功后才推进 cursor。",
    why: "普通 consolidation 只把旧对话摘要追加到 history.jsonl；Dream 是另一条后台路径。它把 SOUL.md、USER.md、MEMORY.md 当前内容嵌进 prompt，创建只含 read/edit/apply_patch/write 的受限 ToolRegistry。只有 stop_reason=completed 且无工具错误才推进 .dream_cursor；真实 working-tree diff 生成提交说明并自动 commit，而不是相信模型自述。",
    model: "不是让实习生口头汇报‘我更新了档案’，而是给有限钥匙、检查真实 diff、成功后盖章并移动处理游标。",
    flow: ["history cursor", "Dream prompt + current files", "restricted tools", "ephemeral direct run", "real diff", "advance cursor", "git commit"],
    files: ["nanobot/agent/memory.py", "nanobot/cli/gateway_runtime.py", "nanobot/utils/git_store.py"],
    code: `# concept sketch：只有干净完成才确认消费\nprompt, cursor = memory.build_dream_prompt()\nresp = await agent.process_direct(prompt, ephemeral=True, tools=dream_tools)\nif completed(resp) and not tool_errors:\n    memory.set_last_dream_cursor(cursor)\ncommit(real_worktree_diff)`,
    points: ["Consolidation 与 Dream 是两条路径", "最小写权限工具集", "成功游标 + 真实 diff 审计"],
    takeaway: "Dream 的优秀设计不在‘模型会反思’，而在失败不会吞历史、权限受限、改动可由 Git 事实核验。",
  },
  {
    id: "N08",
    group: "产品边界",
    groupColor: "#e45f70",
    title: "Gateway 是组合根：共享 Registry，拥有 MCP，并行启动长期服务",
    kicker: "Composition / Ownership / Shutdown",
    motto: "AgentLoop 可以使用 MCP 工具，但连接的 connect / aclose 属于 Gateway；ChannelManager 只消费 outbound 并投递。",
    why: "gateway_runtime.py 创建 Bus、RuntimeEventBus、SessionManager、Cron、共享 ToolRegistry 与 MCPProvider，再把同一 registry 注入 AgentLoop。运行时并行启动 config watcher、AgentLoop、ChannelManager、local triggers 和 health server；MCP 在 Agent 前连接并在退出时关闭。ChannelManager 还负责流式 delta 合并、进度过滤、重复回复抑制与发送重试。",
    model: "组合根像剧院总控：决定谁共用哪套设备、谁先通电、谁最后断电，但不亲自演戏。",
    flow: ["construct shared services", "MCP connect", "gather long-lived tasks", "outbound dispatch", "shutdown signal", "close + session fsync"],
    files: ["nanobot/cli/gateway_runtime.py", "nanobot/channels/manager.py", "nanobot/agent/loop.py", "nanobot/agent/tools/mcp.py"],
    code: `# concept sketch：基础设施所有权在应用层\nregistry = ToolRegistry()\nmcp = MCPProvider(config, registry)\nagent = AgentLoop(tool_registry=registry)\nawait mcp.connect()\nawait gather(agent.run(), channels.start_all(), triggers.run())\nawait mcp.aclose()`,
    points: ["共享工具表避免 MCP 双重所有权", "长期服务显式并发启动", "渠道投递拥有独立可靠性策略"],
    takeaway: "Gateway 不是‘更大的 AgentLoop’，而是资源所有权图；读启动代码时要追同一对象由谁创建、共享和关闭。",
  },
];

const dshLessons: Lesson[] = [
  {
    id: "D01",
    group: "插件内核",
    groupColor: "#4f8df7",
    title: "Cordis：插件为什么能完整撤销",
    kicker: "Fiber / Effect / Dispose",
    motto: "插件不是一次函数调用，而是一棵带所有权的 Fiber；注册什么，就必须能沿同一棵树撤回什么。",
    why: "Agent 长时间运行时会反复创建会话、局部工具和监听器。若注册动作没有所有者，热重载或会话结束后就会留下幽灵服务。Cordis 用 Fiber 把插件、effect 与 disposer 绑在同一生命周期。",
    model: "把插件理解成一张带总闸的临时电路：provide、事件监听和后台任务都是从这张电路分出的支路；拉下总闸时按逆序断开。",
    flow: ["ctx.plugin()", "Registry.plugin()", "new Fiber()", "ctx.provide()", "fiber.effect()", "reverse dispose"],
    files: ["vendor/cordis/src/registry.ts", "vendor/cordis/src/reflect.ts", "vendor/cordis/src/fiber.ts"],
    code: `const fiber = new Fiber(parentContext, plugin)\n\n// provide 并非裸写属性，而是当前 fiber 的 effect\nctx.provide(name, service)\nctx.effect(() => installAndReturnDisposer())\n\n// 卸载时 disposer 按注册的反方向执行`,
    points: ["插件创建所有权节点", "服务注册也是 effect", "清理按逆序且幂等"],
    takeaway: "DSH 可组合性的地基不是“插件很多”，而是每个副作用都被 Fiber 拥有并能确定性回收。",
  },
  {
    id: "D02",
    group: "插件内核",
    groupColor: "#4f8df7",
    title: "Profile × Bundle：配置只合成一次",
    kicker: "Ordered Layers / Single Pass",
    motto: "Bundle 负责分发能力，Profile 只决定层次；所有 patch 展平后进入一次合成，避免逐层修改产生顺序幻觉。",
    why: "Web、Headless 和用户定制共享大量插件，却不能靠多个入口文件复制组装逻辑。DSH 把 bundle manifest、bundle patch、用户 patch 依次收集，再一次性得到最终条目树。",
    model: "不是边启动边改房子，而是先把所有施工图按顺序叠好，合成一张最终蓝图，审核无误后才让施工队进场。",
    flow: ["loadProfile()", "bundle manifests", "patch layers", "layers.flat()", "applyEntryPatches()", "Loader.mount()"],
    files: ["packages/boot/app-boot/src/profile.ts", "packages/boot/app-boot/src/index.ts", "packages/bundle/base/cordis.patch.yml"],
    code: `const layers = await loadProfile(profile)\nconst entries = applyEntryPatches(\n  [], structuredClone(layers.flat()), options\n)\n\nconst ctx = new Context()\nawait loader.mount(entries)`,
    points: ["组合顺序显式", "patch 单次合成", "失败时销毁半成品 Context"],
    takeaway: "DSH 的产品形态不是几个硬编码入口，而是固定顺序、可打印、启动前完成合成的配置程序。",
  },
  {
    id: "D03",
    group: "会话即真源",
    groupColor: "#25ad7c",
    title: "Session：事实日志与模型表面分离",
    kicker: "Durable Log / Surface Projection",
    motto: "事件永远追加；模型看到的 messages 是 surface 节点投影，压缩只换表面，不删事实。",
    why: "流式 chunk、最终回复、工具调用、压缩与 fork 同时存在时，一份可变 messages 数组无法兼顾审计和上下文预算。Session 先保存不可变事实，再单独维护模型可见表面。",
    model: "录像母带一直保留，剪辑时间线可以换版本。模型看到的是当前剪辑，恢复与审计仍能回到母带。",
    flow: ["validate event", "deepFreeze()", "append seq", "surface nodes", "deriveMessages()", "fork stable prefix"],
    files: ["packages/core/session/src/index.ts"],
    code: `const seq = session.append(event) // 校验后追加并冻结\n\nconst messages = session.deriveMessages()\n// surface replace 只改变投影，durable log 仍保留旧事件\n\nconst branch = session.fork(stableBoundary)`,
    points: ["日志只追加且不可变", "存储与模型视图分离", "fork 只能落在稳定边界"],
    takeaway: "DSH 不是把 messages 顺手记日志，而是把日志作为事实层，把 messages 降级成可重建视图。",
  },
  {
    id: "D04",
    group: "轮次边界",
    groupColor: "#a85ce5",
    title: "Agent Driver：三种 Inbox 语义与两层循环",
    kicker: "Follow-up / Steer / Inject",
    motto: "follow-up 等下一 turn，steer 进入下一 step 并唤醒，inject 进入下一 step 但不主动唤醒。",
    why: "运行中的 Agent 收到新消息时，“现在介入”并不是单一语义。DSH 把消息的可见时机和是否唤醒 driver 分开，再用 turn/step 明确处理边界。",
    model: "follow-up 是下一张工单，steer 是敲门要求当前工单下一步立即改向，inject 是往当前材料夹里补一页但不催办。",
    flow: ["inbox mode", "wakeDriver()", "turn()", "claim inputs", "step()", "turn-stopping"],
    files: ["packages/core/agent-loop/src/agent.ts", "packages/core/agent-loop/src/index.ts"],
    code: `followup(message) // next turn\nsteer(message)    // next step + wake driver\ninject(message)   // next step, no wake\n\nwhile (await agent.turn()) {\n  // each turn may contain multiple steps\n}`,
    points: ["消息时机是显式协议", "Turn 与 Step 两层边界", "生命周期事件先记录再执行"],
    takeaway: "DSH 最精细的地方不是 while 循环，而是把新输入何时可见、是否唤醒、归属哪一层边界都写进协议。",
  },
  {
    id: "D05",
    group: "轮次边界",
    groupColor: "#a85ce5",
    title: "Tool Scheduler：并发执行，顺序提交",
    kicker: "Ordered Policy / Concurrent Dispatch",
    motto: "模型给出的调用顺序是语义；真正的 handler 可以并发，但审批和结果提交仍保持原顺序。",
    why: "工具并发能降低延迟，却可能让审批弹窗、写操作和结果历史变得不可预测。DSH 把 prepare、dispatch、finalize 拆开，用 exclusive barrier 和有界滚动池兼顾速度与确定性。",
    model: "餐厅可以并行做菜，但先逐单核对忌口，最后仍按原订单位置装盘；一道独占菜会成为前后两批之间的挡板。",
    flow: ["model-ordered calls", "prepareExecution()", "policy + guards", "bounded dispatch", "ordered finalize", "tool/result events"],
    files: ["packages/core/agent-loop/src/tool-calls.ts", "packages/core/tools/src/index.ts"],
    code: `for (const call of calls) await prepareInOrder(call)\n\n// parallel calls enter a bounded rolling pool\n// exclusive calls form barriers\nawait dispatchConcurrently(prepared)\n\nfor (const call of calls) await finalizeInModelOrder(call)`,
    points: ["策略判断保持顺序", "执行并发受模式约束", "结果按模型顺序提交"],
    takeaway: "DSH 没把“并发”当成 Promise.all，而是把完成顺序与可观察提交顺序刻意分离。",
  },
  {
    id: "D06",
    group: "能力替换",
    groupColor: "#e69f2d",
    title: "Scope：注册、可见性与回收共用一条父链",
    kicker: "ScopedLayers / Shadowing",
    motto: "同名能力不是全局覆盖；查找沿父 scope 从远到近叠层，最具体的局部注册只影响自己的子树。",
    why: "多 Agent、subagent 与远程沙箱需要共享默认工具，同时局部替换文件系统、进程或策略。如果“能看见哪个实现”和“谁负责清理”来自两套机制，隔离迟早失效。",
    model: "一栋楼有总配电，每层可加分配箱，每个房间还能局部改线；房间只覆盖自己的支路，拆房间时线路也随之撤回。",
    flow: ["createScope()", "parent chain", "chainLayers()", "inherited entries", "local shadow", "scope dispose"],
    files: ["packages/core/scope/src/index.ts", "packages/core/scope/src/store.ts", "packages/core/tools/src/index.ts"],
    code: `const child = createScope(parent)\n\n// farthest ancestor → exact scope\nconst layers = scopedLayers.chainLayers(child)\nconst view = tools.view(child)\n\n// local entry shadows inherited name; effect owns cleanup`,
    points: ["身份由父链定义", "最具体层覆盖继承层", "注册与回收共享 Context 所有权"],
    takeaway: "DSH 的 scope 不只是依赖注入容器，而是一条同时决定继承、覆盖、事件传播和资源回收的结构主轴。",
  },
  {
    id: "D07",
    group: "上下文持续",
    groupColor: "#e45f70",
    title: "Compaction：事务式替换模型表面",
    kicker: "Stable Region / Surface Replace",
    motto: "先记录开始，再生成摘要，再确认区间未变化，最后用 replace 事件切换表面；任何一步失败都不能半替换历史。",
    why: "长会话压缩若直接改 messages，摘要失败、并发追加或工具对被切开时会留下不可恢复状态。DSH 把压缩设计成对稳定 surface 区间的事务，并保留全部原始事件。",
    model: "像数据库迁移：先锁定版本与范围，准备新视图，提交前再校验版本，最后原子切换；旧数据并未物理删除。",
    flow: ["select stable region", "compaction/start", "summarize", "recheck stability", "surfaceOp replace", "compaction/end"],
    files: ["packages/compaction/compaction-basic/src/region.ts", "packages/compaction/compaction-basic/src/index.ts"],
    code: `append("compaction/start")\nconst summary = await summarize(stableRegion)\nassertRegionStillStable()\nappend("compaction/summary")\nappendUserMessage({ surfaceOp: { op: "replace", start, end } })\nappend("compaction/end")`,
    points: ["工具调用与结果不能拆对", "提交前重验稳定区间", "替换表面而非删除事实"],
    takeaway: "DSH 的压缩不是摘要算法包装，而是一套为并发会话设计的可审计提交协议。",
  },
  {
    id: "D08",
    group: "组装成产品",
    groupColor: "#14a7a0",
    title: "Web / Headless：表面差异只存在于组合层",
    kicker: "Composition Root / Same Runtime",
    motto: "Headless 没有 Host、HTTP 和浏览器 UI，但仍使用同一套 session、tools、LLM 与 AgentLoop；它不是第二个 Agent。",
    why: "交互式 Web 产品和一次性自动化任务需要不同基础设施。如果为每个入口复制一套执行循环，行为、修复和遥测会迅速分叉。DSH 只替换 bundle patch 的外围组装。",
    model: "同一台发动机装进两种车身：Web 车身带仪表盘与车门，Headless 只保留点火开关和结果出口，传动系统没有复制。",
    flow: ["profile template", "base bundle", "web-app / headless", "surface services", "shared AgentLoop", "session result"],
    files: ["packages/bundle/web-app/cordis.patch.yml", "packages/bundle/headless/cordis.patch.yml", "packages/bundle/headless/src/startup.ts"],
    code: `web      = [base, webApp]\nheadless = [base, headless]\n\n// headless patch provides a task service\n// startup runner consumes it and drives the shared agent runtime`,
    points: ["入口能力由 patch 决定", "Headless 不挂 Web 基础设施", "产品表面复用同一运行时"],
    takeaway: "DSH 的 Web 与 Headless 不是两套实现，而是同一插件内核在组合树最外层的两种投影。",
  },
];

const piLessons: Lesson[] = [
  {
    id: "P01",
    group: "运行时地图",
    groupColor: "#ef684c",
    title: "Monorepo：先区分稳定产品与实验 Harness",
    kicker: "Packages / Maturity Boundary",
    motto: "当前 Coding Agent 仍由 Agent + AgentSession 驱动；同包导出的 AgentHarness 是 vNext 契约骨架，不能因为公开 export 就当作已落地。",
    why: "当前仓库已经超过早期的 ai / agent / coding-agent / tui 四层，还加入 telemetry、protocol、client、server 与持久化 harness。若只按目录名讲，会把实验 API 和真实产品路径混为一谈。",
    model: "像一座正在扩建的车站：旧站台每天正常发车，新站台已经有结构图和部分轨道，但入口仍挂着施工牌。读源码先看列车实际从哪里出发。",
    flow: ["pi-ai", "Agent class", "AgentSession", "coding-agent surfaces", "pi-tui / RPC", "AgentHarness vNext"],
    files: ["README.md", "packages/agent/src/index.ts", "packages/agent/src/harness/agent-harness.ts", "packages/coding-agent/src/core/sdk.ts"],
    code: `// 当前产品路径\nnew Agent(...) → new AgentSession(...) → TUI / RPC / SDK\n\n// 同包另有 vNext public API\nAgentHarness.create(...)\n// 但 prompt/steer/resume 等仍返回 HarnessNotImplemented`,
    points: ["包导出不等于功能成熟", "经典 Agent 仍驱动 Coding Agent", "实验 Harness 必须单独标注"],
    takeaway: "读 PI 的第一步不是背包名，而是用调用方证明哪条路径真的运行，再把公开但未完成的 vNext 与稳定产品隔开。",
  },
  {
    id: "P02",
    group: "模型协议",
    groupColor: "#ef684c",
    title: "pi-ai：Provider 拥有协议，Models 只做调度",
    kicker: "Side-effect-free Core / Lazy APIs",
    motto: "根入口只导出无副作用核心；具体 provider factory 和 API adapter 分路径加载，但最后必须输出同一 AssistantMessageEvent 协议。",
    why: "模型差异不仅是 URL，还包括认证、思考块、延迟加载、动态模型目录、deferred response 与流错误。PI 让 Provider 同时拥有 catalog、auth 和 stream，Models 只按 provider id 解析并委托。",
    model: "Models 像总机，只查号码和接线；每家 Provider 自己负责营业时间、身份核验和通话协议，接通后都转换成统一字幕。",
    flow: ["Models.getModel()", "Provider auth", "lazyApi()", "provider stream", "AssistantMessageEvent", "Agent streamFn"],
    files: ["packages/ai/src/index.ts", "packages/ai/src/models.ts", "packages/ai/src/api/lazy.ts", "packages/ai/src/types.ts"],
    code: `const model = models.getModel(providerId, modelId)\nconst stream = models.streamSimple(model, context, options)\n\nstart → text/thinking/toolcall deltas\n      → done(message) | error(message)`,
    points: ["核心入口无注册副作用", "Provider 同时拥有认证与流", "失败也进入统一事件协议"],
    takeaway: "PI 的多模型抽象不是抹平所有能力，而是固定上层必须依赖的事件语法，把延迟加载和认证留给 Provider。",
  },
  {
    id: "P03",
    group: "Agent 内核",
    groupColor: "#4f8df7",
    title: "Agent Loop：内外两层循环对应两种队列",
    kicker: "Inner Steering / Outer Follow-up",
    motto: "内层处理工具与 steering，外层只在 Agent 本应停止时检查 follow-up；队列语义直接写在控制流里。",
    why: "运行中补充要求与结束后追加任务不是同一种输入。如果统一在每次模型请求前 drain，follow-up 会过早介入；如果统一等结束，steering 又不能及时改向。",
    model: "内层像正在执行的工单：每完成一轮就看是否有改向备注；外层像工单关闭台，确认没有后续工单才真正下班。",
    flow: ["agent_start", "inner turn loop", "LLM stream", "tool batch", "steering drain", "follow-up drain", "agent_end"],
    files: ["packages/agent/src/agent.ts", "packages/agent/src/agent-loop.ts", "packages/agent/src/types.ts"],
    code: `let pending = drainSteering()\nwhile (true) {                 // follow-up boundary\n  while (hasTools || pending.length) {\n    await runAssistantAndTools()\n    pending = drainSteering() // after a complete turn\n  }\n  pending = drainFollowUp()   // only when otherwise idle\n  if (!pending.length) break\n}`,
    points: ["Steering 不跳过当前工具批次", "Follow-up 只在自然停止点进入", "Agent listener 是可等待 barrier"],
    takeaway: "PI 的队列不是 UI 小功能，而是内外两层循环的停止协议；时机写错就会改变用户意图。",
  },
  {
    id: "P04",
    group: "Agent 内核",
    groupColor: "#4f8df7",
    title: "双重投影：存储消息、应用上下文、模型协议",
    kicker: "transformContext → convertToLlm",
    motto: "先在 AgentMessage 层决定本轮看哪些应用事实，再把自定义角色转换成三种 LLM Message；两个问题不能合成一个 filter。",
    why: "bashExecution、custom、branchSummary 和 compactionSummary 都值得持久化与展示，却不是 provider 原生角色。与此同时，扩展还需要在每轮动态裁剪或注入上下文。",
    model: "档案库保存原件；策展人先选这次展出的材料，翻译员再把选中材料转换成观众能读的语言。选材和翻译是两道边界。",
    flow: ["persisted AgentMessage[]", "transformContext()", "selected app messages", "convertToLlm()", "Message[]", "Provider"],
    files: ["packages/agent/src/types.ts", "packages/agent/src/agent-loop.ts", "packages/coding-agent/src/core/messages.ts"],
    code: `let selected = context.messages\nselected = await transformContext?.(selected) ?? selected\n\nconst providerMessages = await convertToLlm(selected)\n// bash / summary / custom 在这里映射；UI-only 可被过滤`,
    points: ["持久化格式不受 Provider 限制", "上下文治理发生在应用消息层", "转换函数必须穷尽自定义角色"],
    takeaway: "PI 明确区分“系统记住了什么”“这一轮选择什么”“模型协议允许什么”，这是扩展消息不会污染核心的关键。",
  },
  {
    id: "P05",
    group: "工具与控制",
    groupColor: "#a85ce5",
    title: "Tool Batch：一把顺序锁约束整批调用",
    kicker: "Batch Mode / Ordered Artifacts",
    motto: "只要批次中任一工具声明 sequential，整批就串行；并行模式也先按顺序预检，完成事件可乱序，结果消息必须回到模型原顺序。",
    why: "混合读写工具时，逐工具并发看似灵活，却会让写操作被前后读操作越过；如果再按完成顺序回填结果，同一组模型输出还会生成不同的下一轮上下文。PI 选择更保守的批次语义：任一工具要求顺序，整批统一降级；并行批次只放开执行阶段，预检和结果 artifact 仍保持模型源顺序。",
    model: "一列货车里只要有一节危险品，整列都走专用慢线；普通列车可并行卸货，但最终提货单仍按车厢编号排列。",
    flow: ["Tool Calls", "Validate", "beforeToolCall", "Parallel / Sequential", "afterToolCall", "Ordered Results"],
    files: ["packages/agent/src/agent-loop.ts", "packages/agent/src/types.ts"],
    code: `const sequential = globalMode === "sequential"\n  || calls.some(call => tool(call).executionMode === "sequential")\n\n// parallel: prepare in source order, execute concurrently\n// emit end in completion order, emit toolResult in source order`,
    points: ["单个 sequential 使整批串行", "Preflight 始终按源顺序", "所有结果 terminate 才提前停止"],
    takeaway: "PI 牺牲一点混合并发度，换来批次级因果关系；源码里没有“各工具各跑各的”这一行为。",
  },
  {
    id: "P06",
    group: "会话交互",
    groupColor: "#25ad7c",
    title: "AgentSession：事件处理器就是产品提交屏障",
    kicker: "Persist / Extensions / Retry",
    motto: "Agent 先归约内部状态，再按订阅顺序 await listener；AgentSession 在同一道 barrier 里通知扩展、写 SessionManager、更新重试与压缩状态。",
    why: "如果 UI 已看到 turn 结束，而 transcript 还没持久化，工具前钩子也未完成，下一阶段就会读取半提交状态。PI 让 Agent listener promise 成为执行循环真正等待的边界。",
    model: "像数据库提交前的触发器：一条事件先更新内存，再依次完成扩展和持久化；全部 settle 后，运行时才宣告 idle。",
    flow: ["AgentEvent", "Agent state reducer", "await listeners", "extension events", "SessionManager.append", "retry / compact", "agent settled"],
    files: ["packages/agent/src/agent.ts", "packages/coding-agent/src/core/agent-session.ts", "packages/coding-agent/src/core/sdk.ts"],
    code: `await agent.processEvents(event)\n  → reduce Agent state\n  → await AgentSession listener\n      → await extension event\n      → appendMessage(event.message)\n      → update retry / compaction\n\n// waitForIdle resolves after agent_end listeners settle`,
    points: ["状态先归约再通知", "持久化发生在 awaited listener", "Idle 晚于 agent_end 事件"],
    takeaway: "AgentSession 不是杂项服务箱；它利用可等待事件屏障，把通用循环的一次状态变化提交成可靠产品事实。",
  },
  {
    id: "P07",
    group: "会话交互",
    groupColor: "#25ad7c",
    title: "JSONL Tree：追加文件、活动叶子与压缩投影",
    kicker: "parentId / Leaf / Context View",
    motto: "每个条目追随当前 leaf，branch() 只移动指针；buildContextEntries() 再从活动路径选择最新压缩摘要与保留后缀。",
    why: "一份 JSONL 既要保留所有分支，又要只给模型发送当前路径，并在长对话里跳过已摘要前缀。简单按文件行顺序读取无法同时满足三者，还会把用户已经切走的旧分支重新喂给模型。PI 因此把追加存储、活动 leaf 与模型上下文投影拆成三个独立动作。",
    model: "像 Git 对象库：文件里保存所有 commit，HEAD 选择当前链；压缩摘要像一张新的基线快照，只改变 checkout 视图，不删除旧对象。",
    flow: ["append entry", "parentId = leaf", "move leaf", "walk to root", "latest compaction", "project context"],
    files: ["packages/coding-agent/src/core/session-manager.ts", "packages/coding-agent/src/core/messages.ts"],
    code: `{ type: "message", id: "b2c3d4e5",\n  parentId: "a1b2c3d4", message: ... }\n\n// change leaf, append new child\n// old branch remains in the same JSONL`,
    points: ["追加动作推进 leaf", "分支不修改旧条目", "模型上下文是 compaction-aware 投影"],
    takeaway: "PI 的 JSONL 不是线性 transcript，而是对象存储；leaf 和投影算法共同决定模型此刻看到哪条历史。",
  },
  {
    id: "P08",
    group: "可塑产品",
    groupColor: "#e69f2d",
    title: "ResourceLoader × Extensions：先判信任，再热替换能力",
    kicker: "Trust Bootstrap / Stale Context",
    motto: "项目扩展不会在判定信任前直接加载；reload 创建新 runtime，并让旧 ExtensionContext 失效，阻止被替换插件继续操作新会话。",
    why: "扩展是可执行 TypeScript，项目级资源不能与普通 Markdown 等价对待。热重载若只清 module cache、不废弃旧上下文，旧事件订阅和捕获引用会跨会话存活。",
    model: "像更换门禁系统：先用受信任的最小控制台确认楼层权限，再启用项目设备；换代后旧门卡必须失效，不能继续开新门。",
    flow: ["untrusted bootstrap", "project trust", "package resolve", "load extensions", "register capabilities", "invalidate old runtime", "reload resources"],
    files: ["packages/coding-agent/src/core/resource-loader.ts", "packages/coding-agent/src/core/extensions/loader.ts", "packages/coding-agent/src/core/extensions/types.ts"],
    code: `const bootstrap = await loadProjectTrustExtensions()\nsetProjectTrusted(await resolveTrust(bootstrap))\nawait loadFinalExtensionSet()\n\n// session replacement / reload\noldRuntime.invalidate()\n// captured old ctx now throws a stale-context error`,
    points: ["项目代码先过信任门", "资源来源与诊断一起保留", "旧扩展上下文被主动毒化"],
    takeaway: "PI 的扩展能力不只在 registerTool；更值得学的是它把信任启动、资源来源和热重载后的引用失效一起设计。",
  },
];

const claudeLessons: Lesson[] = [
  {
    id: "C01", group: "启动拓扑", groupColor: "#d97757", title: "CLI 导入图就是性能架构", kicker: "Fast Path / Dynamic Import",
    motto: "先让版本号、ACP、daemon、remote、worktree 等模式在轻入口终止；确认走默认产品后，才加载 main 与 React Ink。",
    why: "大型 Coding Agent 的启动成本不是几毫秒小事：静态 import 会初始化配置、遥测、MCP、UI 和大量工具。这个复原实现把 performance shim 放在第一条 import，并用几十个 argv fast path 把不同进程角色隔开；--bare 甚至要在加载 main 前写入环境变量。",
    model: "把模块图当成机场分流：只查航班的人不进入安检，后台货运也不穿过候机楼；只有交互旅客才支付完整设施成本。",
    flow: ["minimal imports", "argv inspection", "mode fast path", "early env mutation", "dynamic main import", "REPL / print"],
    files: ["src/entrypoints/cli.tsx", "src/main.tsx"],
    code: `// concept sketch：先终止专用模式，再加载完整产品\nif (versionOnly) return printVersion()\nif (acpMode) return import("../services/acp/run.js")\nif (bareMode) process.env.CLAUDE_CODE_BARE = "1"\nconst { main } = await import("../main.js")`,
    points: ["入口首条 import 有内存语义", "专用进程动态加载自己的依赖", "环境开关在主模块求值前生效"],
    takeaway: "读 CLI 不要只找 main()；先画静态 import 和动态 import 的边界，它直接决定冷启动、内存与副作用范围。",
  },
  {
    id: "C02", group: "产品外壳", groupColor: "#d97757", title: "REPL 与 QueryEngine 共用循环，但不共用外壳", kicker: "Two Shells / One Loop",
    motto: "当前 REPL 直接调用 query() 并用 React state 与 hooks 持久化；QueryEngine 则服务 headless/SDK 和 ACP，会话跨 submitMessage 保存。",
    why: "旧讲法常把所有入口都画成 REPL → QueryEngine → query，但源码注释明确说 REPL 接入 QueryEngine 是 future phase。当前两条路径拥有不同产品状态：REPL 用 QueryGuard、useLogMessages、输入队列和 Ink 状态；QueryEngine 保存 mutableMessages、usage、permission denials 与 file cache。它们只在 query() 这一层汇合。",
    model: "两种驾驶舱共用同一发动机：终端驾驶舱自己管仪表和日志，ACP/SDK 驾驶舱用 QueryEngine 管会话；不能因为发动机相同就说驾驶舱相同。",
    flow: ["REPL or ACP/SDK", "product-owned state", "query()", "queryLoop", "events", "own persistence/UI"],
    files: ["src/screens/REPL.tsx", "src/QueryEngine.ts", "src/services/acp/agent/createSessionMethod.ts", "src/query.ts"],
    code: `// REPL\nfor await (const event of query(params)) onQueryEvent(event)\n\n// ACP / SDK\nconst engine = new QueryEngine(config)\nfor await (const event of engine.submitMessage(prompt)) yield event`,
    points: ["共享运行心脏不等于共享会话壳", "跨轮状态由入口各自拥有", "注释中的 future phase 不能当成已实现事实"],
    takeaway: "验证复用关系时必须找真实构造点和调用点；类注释中的愿景、export 和当前产品路径是三种不同证据。",
  },
  {
    id: "C03", group: "循环状态机", groupColor: "#4f8df7", title: "queryLoop：把恢复分支写成显式状态迁移", kicker: "Projection / Transition / Recovery",
    motto: "每次迭代先从完整消息投影 model view，再请求模型；压缩、413、输出截断、stop hook 与工具结果都通过 State + transition 进入下一次循环。",
    why: "模型调用失败并不只有 throw：prompt too long 可先 drain granular collapse，再 reactive compact；max output 可原请求升限或注入 continuation；stream fallback 必须 tombstone 孤儿消息和丢弃旧工具执行器。若这些恢复靠递归和散落布尔值，很容易产生死循环或不匹配的 tool_result。",
    model: "像列车运行图：每次发车前重算可见线路；晚点、换线、折返都有具名 transition，下一班从完整状态表继续，不靠口头约定。",
    flow: ["full messages", "model-view projections", "provider stream", "named recovery", "tool phase or stop", "next State"],
    files: ["src/query.ts", "src/query/deps.ts", "src/services/api/claude.ts"],
    code: `let state = initialState\nwhile (true) {\n  let modelView = project(state.messages)\n  const response = await stream(modelView)\n  if (needsCompact) { state = next("reactive_compact_retry"); continue }\n  if (hasTools) state = next("next_turn")\n  else return terminal\n}`,
    points: ["持久消息与模型视图分离", "恢复原因进入显式 transition", "失败流的孤儿消息与工具结果成对清理"],
    takeaway: "Agent Loop 的含金量不在 while(true)，而在每个 continue 是否携带完整、可解释、不会再次触发同一死循环的状态。",
  },
  {
    id: "C04", group: "工具协议", groupColor: "#a85ce5", title: "并发结果可抢跑，上下文副作用按源顺序提交", kicker: "Capability / Batch / Determinism",
    motto: "Tool 按具体输入声明 isConcurrencySafe；连续安全调用并发执行并实时流出结果，但 contextModifier 等全部完成后仍按 tool_use 原顺序应用。",
    why: "只把 read-only 工具 Promise.all 还不够：完成顺序会随网络与磁盘抖动变化，如果每个结果立即修改 read cache 或产品上下文，同一提示会产生不同后续状态。这里把‘用户何时看见结果’和‘系统何时提交状态’拆开，最大并发默认 10，危险工具则形成串行单元。",
    model: "多窗口可同时受理，谁先办完就先播报；但会改总账的凭证最后仍按取号顺序入账，保证账本可复现。",
    flow: ["tool_use blocks", "schema + capability check", "adjacent batches", "concurrent stream", "ordered modifiers", "stable next context"],
    files: ["src/Tool.ts", "src/tools.ts", "src/services/tools/toolOrchestration.ts"],
    code: `for (const batch of partitionToolCalls(calls)) {\n  if (batch.safe) {\n    yield* runConcurrently(batch)\n    applyQueuedModifiersInSourceOrder(batch)\n  } else {\n    yield* runSerially(batch)\n  }\n}`,
    points: ["并发安全是 input-dependent 能力", "UI 完成顺序与状态提交顺序分离", "异常能力判断保守降级为串行"],
    takeaway: "真正可靠的工具并发要回答两件事：结果何时可见，以及共享状态按什么确定顺序提交。",
  },
  {
    id: "C05", group: "工具协议", groupColor: "#a85ce5", title: "Hook 允许也不能越过 deny / ask 规则", kicker: "Validation / Policy / Defense-in-depth",
    motto: "tool_use 先过 Zod 与工具语义校验，再运行 PreToolUse；Hook 的 allow 只能跳过普通交互提示，显式 deny 仍覆盖，ask 仍必须询问。",
    why: "Hook 常由组织配置或插件提供，不能让它成为隐蔽的超级权限。源码还会提前并发启动 Bash classifier、剥离模型伪造的内部 _simulatedSedEdit 字段，并区分 observer 用的 backfilled input 与真正传给 tool.call 的原始 input，避免 prompt cache 和 transcript hash 被观察字段污染。",
    model: "Hook 像部门主管签字，但消防禁令仍能否决，强制双人确认仍要弹窗；内部通行章也不能由申请人自己填写。",
    flow: ["Zod schema", "tool validateInput", "PreToolUse hooks", "rule + canUseTool", "tool.call", "PostToolUse"],
    files: ["src/services/tools/toolExecution.ts", "src/services/tools/toolHooks.ts", "src/Tool.ts"],
    code: `parsed = tool.inputSchema.safeParse(input)\nvalidated = await tool.validateInput(parsed.data)\nhookDecision = await runPreToolUseHooks(validated)\ndecision = await resolveHookPermissionDecision(hookDecision)\nif (decision.behavior === "allow") await tool.call(decision.input)`,
    points: ["类型错误与语义错误分层", "Hook allow 受 deny/ask 规则约束", "观察输入与执行输入避免意外耦合"],
    takeaway: "安全链不是‘多做几次 if’，而是明确每个决策者能放宽什么、不能覆盖什么，以及最终哪份输入产生副作用。",
  },
  {
    id: "C06", group: "上下文工程", groupColor: "#25ad7c", title: "Prompt 不是字符串，而是三套优先级系统", kicker: "System / User / Memory",
    motto: "system prompt 决定 override、coordinator、agent、custom、default 的替换关系；system context 固化 Git 快照；user context 再按 Managed → User → Project → Local 发现 CLAUDE.md。",
    why: "把所有提示拼接称为‘Prompt Builder’会隐藏最重要的问题：谁覆盖谁、何时缓存、来源是否可信。override 会替换全部系统提示；agent prompt 通常替换 default，而 proactive 模式才追加；Git status 是会话开局快照；CLAUDE.md 从根向 cwd 加载，越接近 cwd 越晚、优先级越高，外部 include 还有单独批准。",
    model: "不是一份随手粘贴的说明书，而是宪法、当日环境快照和分层项目规章三本册子；每本册子的覆盖规则与刷新频率都不同。",
    flow: ["system prompt priority", "cached git snapshot", "memory discovery", "include / trust filter", "user context", "API cache blocks"],
    files: ["src/utils/systemPrompt.ts", "src/context.ts", "src/utils/claudemd.ts"],
    code: `systemPrompt = buildEffectiveSystemPrompt(priorityInputs)\nsystemContext = await getSystemContext() // cached Git snapshot\nfiles = await getMemoryFiles()           // ordered sources\nuserContext = { claudeMd: getClaudeMds(files), currentDate }`,
    points: ["替换与追加语义显式", "动态环境按会话缓存", "记忆文件顺序、include 与来源可追踪"],
    takeaway: "排查模型行为时先问这句话属于哪一种上下文、覆盖了谁、何时刷新；不要从最终长字符串反向猜。",
  },
  {
    id: "C07", group: "持久与恢复", groupColor: "#25ad7c", title: "Compact 后保留 UUID，恢复时重连端点", kicker: "Boundary / Relink / JSONL DAG",
    motto: "compact 产出 boundary + summary + kept segment；已写过的 kept messages 不重复写 JSONL，所以 boundary 记录 head/anchor/tail，恢复时再修正端点。",
    why: "难点不是生成摘要，而是磁盘上保留消息仍带旧 parentUuid。若 recordTranscript 因 UUID 去重后还用它们推进写游标，新消息会重新链回压缩前历史；若简单改写旧行，又破坏 append-only。这个实现让 boundary 保存 relink metadata，读取时验证 tail→head 完整性，失败则宁可加载完整旧历史，也不静默截断。并行 tool_use 形成的 DAG 还要做 sibling/tool_result 恢复。",
    model: "案卷原页不重写，只在新索引页记录‘摘要后接回哪一叠原页’；恢复时先验页码连续，再把两端接上。",
    flow: ["token threshold", "summary + kept segment", "boundary metadata", "queued JSONL append", "read-side relink", "DAG recovery + consistency check"],
    files: ["src/services/compact/autoCompact.ts", "src/services/compact/compact.ts", "src/utils/sessionStorage.ts", "src/QueryEngine.ts"],
    code: `post = [boundary, ...summary, ...messagesToKeep]\nboundary.preservedSegment = { headUuid, anchorUuid, tailUuid }\nawait recordTranscript(post) // UUID dedup keeps old rows immutable\nloaded = applyPreservedSegmentRelinks(readJsonl())\nreturn buildConversationChain(loaded, leaf)`,
    points: ["append-only 与保留后缀同时成立", "恢复前验证 relink 元数据", "并行工具结果需要 DAG 后处理"],
    takeaway: "生产级 compaction 必须设计 write→load round trip；只验证压缩后当前内存可用，还没有证明 resume 正确。",
  },
  {
    id: "C08", group: "扩展边界", groupColor: "#e69f2d", title: "MCP 适配成 Tool；插件更像受策略约束的资源包", kicker: "Protocol Adapter / Resource Precedence",
    motto: "MCP server 的 tools/commands/resources 被转换成内部 Tool 协议并可在 turn 间刷新；plugin loader 则验证 manifest、路径和 hooks，并执行 session > marketplace > builtin 的来源优先级。",
    why: "扩展并不是把外部对象直接塞进循环。MCP annotations 被翻译成 concurrency/readOnly/destructive/openWorld，schema、权限、进度、断线重连和大结果治理继续走内部工具协议；本地与远程 server 使用不同连接并发。插件侧还受 managed settings 约束：管理员锁定的 marketplace 插件不能被 --plugin-dir 覆盖。",
    model: "MCP 是协议转接头，插上后仍使用整栋楼的电气规范；插件是带清单的资源箱，入库前核验内容、来源和企业封条。",
    flow: ["MCP / plugin sources", "connect or manifest validate", "capability translation", "policy precedence", "product state", "refresh between turns"],
    files: ["src/services/mcp/client.ts", "src/utils/plugins/pluginLoader.ts", "src/query.ts", "src/screens/REPL.tsx"],
    code: `mcpTool = adaptToInternalTool({\n  schema, isConcurrencySafe, isDestructive, checkPermissions, call\n})\nplugins = mergePluginSources({ session, marketplace, builtin, managedNames })\n// after a tool turn\ncontext.options.tools = context.options.refreshTools?.() ?? context.options.tools`,
    points: ["外部能力进入统一安全与并发协议", "本地/远程连接采用不同资源预算", "会话插件可覆盖普通安装但不能绕过管理策略"],
    takeaway: "扩展性的重点不是能加载多少来源，而是外部能力进入后是否继续服从内部契约、优先级和生命周期。",
  },
];

const openclawLessons: Lesson[] = [
  {
    id: "O01", group: "总览", groupColor: "#ef684c", title: "先画所有权地图：一次消息经过六个世界", kicker: "Ingress → Runtime → Delivery",
    motto: "Channel 先把外部事件规范化，routing 固化会话归属，Harness 选择执行世界，Runner 准备现实条件，agent-core 推进循环，delivery 最后对外承诺结果。",
    why: "OpenClaw 不是从 prompt() 开始的。一个 Telegram 或 Discord 事件在模型看到之前，已经经历 ingest、classify、preflight、route 与 session record；模型循环结束后，消息仍要经过渠道 payload、durable send、回执与 finalization。学习它的第一步不是找最大的 Agent 类，而是问：这一层拥有什么事实，失败时由谁收尾？",
    model: "把它看成机场而不是飞机：Channel 是值机柜台，routing 是登机牌，Harness 是执飞航司，Runner 是地勤，agent-core 是飞行控制，delivery 是到达确认。飞机很重要，但机场系统决定一次旅程是否真的完成。",
    flow: ["Channel ingest", "Route + session key", "Harness selection", "Prepared Runner", "agent-core loop", "Delivery settlement"],
    files: ["src/channels/turn/run-channel-turn.ts", "src/agents/harness/selection.ts", "src/agents/harness/builtin-openclaw.ts", "src/agents/runtime/index.ts"],
    code: `// concept sketch — 阅读路径，不是仓库原文\ninput = adapter.ingest(raw)\nturn = adapter.resolveTurn(input)\nharness = selectAgentHarness(preparedRoute)\nresult = harness.runAttempt(preparedAttempt)\nawait delivery.settle(result)`,
    points: ["先归属再执行", "运行实现可选择", "外部完成由投递层定义"],
    takeaway: "读任何 OpenClaw bug 时，先定位它属于接入、身份、执行还是投递；跨层补偿通常意味着真正的所有者还没找到。",
  },
  {
    id: "O02", group: "执行内核", groupColor: "#ef684c", title: "agent-core：两层循环、双队列与并发工具的确定边界", kicker: "Agent / Loop / Steering",
    motto: "Agent 是可观察外壳，runLoop 才是状态机；steering 插入正在运行的内层循环，follow-up 只在本应结束时重启外层循环。",
    why: "一个 while(toolCalls) 只能完成 demo。生产循环还要回答：流式 assistant 何时成为正式消息？中途输入是在当前工具前生效还是下一轮生效？并行工具结果怎样保持模型原始顺序？abort 后如何留下可继续的 transcript？OpenClaw 把这些答案写进 core 的事件顺序与检查点，而不是交给每个 UI 自己猜。",
    model: "像带两条候车线的调度站：steering 是正在运行班次的临时改线，follow-up 是班次结束后才发出的下一趟车；并行站点可以同时作业，但结果仍按原车厢顺序编组。",
    flow: ["Agent.prompt", "inner tool loop", "steering checkpoint", "ordered tool results", "prepareNextTurn", "outer follow-up loop"],
    files: ["packages/agent-core/src/agent.ts", "packages/agent-core/src/agent-loop.ts", "packages/agent-core/src/types.ts"],
    code: `// concept sketch\nwhile (true) {                 // follow-up loop\n  while (toolCalls || steering) {\n    assistant = await streamModel()\n    results = await executeBatchInParallel()\n    appendResultsInSourceOrder(results)\n  }\n  if (!drainFollowUps()) break\n}`,
    points: ["事件先归约再通知", "steering 与 follow-up 语义不同", "并行执行不破坏 transcript 顺序"],
    takeaway: "学习 Agent loop 不要只看模型调用；真正的架构含金量在‘输入何时可见、结果何时提交、停止何时成立’。",
  },
  {
    id: "O03", group: "执行内核", groupColor: "#ef684c", title: "Embedded Runner：会话串行、全局限流与重试预算", kicker: "Lane / Lease / Recovery",
    motto: "同一 session 先排队，跨 session 再过全局 lane；每次运行租用固定 prepared runtime，在有界 retry loop 中做 auth、fallback、compaction 与终态归一。",
    why: "Runner 解决的是 core 刻意不解决的现实问题：同一会话不能交叉写 transcript，整台机器不能无限并发，配置 reload 不能撕裂一次运行，认证轮换与上下文溢出不能无限重试。run-orchestrator 先建立 session/global 两层 admission，再租用快照；run-loop 只允许在明确预算内产生 successor attempt，最终还要释放 context engine 与 MCP 资源。",
    model: "像数据库事务调度器：session lane 是行锁，全局 lane 是连接池，prepared runtime lease 是事务快照，retry budget 是防止死循环的重试上限。",
    flow: ["Backfill identity", "Session lane", "Global lane", "Acquire runtime lease", "Bounded attempts", "Release + cleanup"],
    files: ["src/agents/embedded-agent-runner/run-orchestrator.ts", "src/agents/embedded-agent-runner/run-loop.ts", "src/agents/embedded-agent-runner/run/attempt.ts"],
    code: `// concept sketch\nreturn sessionLane.run(() => globalLane.run(async () => {\n  const lease = await acquirePreparedRuntime()\n  try { return await runBoundedRetryLoop(lease.snapshot) }\n  finally { lease.release() }\n}))`,
    points: ["并发限制分两层", "一次运行绑定一个快照", "每种恢复都消费预算并留下终态"],
    takeaway: "Runner 不是 core 的包装器，而是故障域：并发、配置、认证、压缩和清理都在这里被变成可追踪的运行契约。",
  },
  {
    id: "O04", group: "渠道控制面", groupColor: "#4f8df7", title: "Channel Turn：先记录、后执行、最后结算投递", kicker: "Admission / Record / Settlement",
    motto: "一次渠道轮次不是 send(prompt)：它先把原生事件归一并做 admission，再把入站事实写进 session，之后才 dispatch；出站发送必须等 provider finalization 和可见性回执结算。",
    why: "渠道可能把 reaction、bot echo 或非法事件送进来；回复也可能已经被平台接受，却在稍后的 finalization 抛错。若模型执行与渠道发送共用一个模糊 try/catch，系统会重复发送、丢失入站历史，或把‘没有可见回复’误判为成功。OpenClaw 为 ingest、record、dispatch、delivery settlement 分别保留结果，并把 observeOnly、drop、handled、dispatch 做成封闭 admission 类型。",
    model: "像支付清算：下单、入账、扣款和到账是四个不同状态；接口返回不等于对方已经收到，也不能因到账回执迟到就重复扣款。",
    flow: ["Ingest + classify", "Preflight admission", "Assemble route", "Record inbound", "Dispatch reply", "Settle delivery receipt"],
    files: ["src/channels/turn/run-channel-turn.ts", "src/channels/turn/execution.ts", "src/channels/turn/lifecycle.ts"],
    code: `// concept sketch\ninput = await adapter.ingest(raw)\nadmission = await adapter.preflight(input)\nturn = assemble(await adapter.resolveTurn(input))\nawait recordInboundSession(turn)\nreply = await runDispatch(turn)\nawait settlePendingDeliveries(reply)`,
    points: ["admission 是显式状态", "入站记录早于模型执行", "发送成功以结算回执为准"],
    takeaway: "渠道系统的正确性不是‘模型回答了’，而是每个外部动作都有可见结果或明确记录的非动作。",
  },
  {
    id: "O05", group: "渠道控制面", groupColor: "#4f8df7", title: "Routing × Session Key：先选 Agent，再编码对话隔离", kicker: "Bindings / Identity / Scope",
    motto: "binding tiers 决定 agentId，dmScope 再决定会话颗粒度；session key 是路由结果的稳定编码，不是授权令牌，也不是随手拼的字符串。",
    why: "一个渠道账号下可能有私聊、群组、频道、线程、guild role 与多个机器人账号。源码按 peer、parent peer、peer wildcard、guild+roles、guild、team、account、channel 的层级匹配，最后才回落默认 Agent；选定 Agent 后，direct chat 还能选择 main、per-peer、per-channel-peer 或 per-account-channel-peer。两步混在一起，就很难解释为什么两个人共享历史或同一人跨渠道不共享历史。",
    model: "像先分配医生，再建立病历号：binding 选择由谁负责，dmScope 决定病历按个人、科室还是账号隔离。病历号帮助找记录，但不能代替门禁权限。",
    flow: ["Normalize channel identity", "Match binding tier", "Choose agentId", "Apply dmScope", "Build session key", "Record last-route policy"],
    files: ["src/routing/resolve-route.ts", "src/routing/session-key.ts", "docs/channels/channel-routing.md"],
    code: `// concept sketch\nagent = firstMatch(peer, parent, roles, guild, team, account, channel)\nsessionKey = buildAgentPeerSessionKey({\n  agentId: agent.id, dmScope, channel, accountId, peerId\n})`,
    points: ["责任选择与历史隔离分开", "匹配层级可解释", "畸形 agent key 拒绝默认降级"],
    takeaway: "调试串线问题时必须同时打印 matchedBy、agentId、dmScope 与 sessionKey；只看最后一个 key 会丢掉决策过程。",
  },
  {
    id: "O06", group: "运行时一致性", groupColor: "#a85ce5", title: "Prepared Runtime：用原子世代阻止半新半旧", kicker: "Generation / Gate / Lease",
    motto: "配置、插件、认证和模型目录先在 replacement gate 后完整构建；只有整批 owner 都准备好才发布，新运行拿 lease，旧运行继续持有不可变快照。",
    why: "热更新最危险的不是失败，而是部分成功：模型目录已经更新，认证 store 仍是旧的；插件 registry 已切换，某个 Agent 的 catalog 构建尚未完成。prepared-model-runtime 用 pending replacement gate 隐藏所有中间态，refresh 按 epoch 串行，失败会把整批 owner 标成不可读。lease 还用 owner identity 防止旧释放误删新世代。",
    model: "像数据库 MVCC：后台准备新版本，提交点一次切换；已开始的事务继续读旧快照，新事务只读完整新版本，旧事务结束后再回收。",
    flow: ["Mark stale", "Open replacement gate", "Build owner batch", "Atomic publish", "Acquire exact lease", "Identity-safe release"],
    files: ["src/agents/prepared-model-runtime.ts", "src/agents/prepared-model-runtime.owner.ts", "src/agents/embedded-agent-runner/run-orchestrator.ts"],
    code: `// concept sketch\nmarkSnapshotsStale({ waitForReplacement: true })\nawait buildAllConfiguredOwners(epoch)\ncommitReplacementGate()\nconst { snapshot, release } = await acquireAgentRunRuntime(input)`,
    points: ["读者看不到构建中状态", "刷新是整批事务", "旧 release 不得删除新 owner"],
    takeaway: "凡是多个可变来源共同决定一次运行，都应考虑 generation + lease，而不是在请求热路径里重复发现和原地更新。",
  },
  {
    id: "O07", group: "能力安全", groupColor: "#a85ce5", title: "工具权限不是一次判断：先裁目录，再审每次调用", kicker: "Surface Policy / Call Policy",
    motto: "静态 policy pipeline 决定模型能看到哪些工具；运行时 before_tool_call chain 再对最终参数执行 loop detection、可信策略、审批、普通 Hook、最终 owner 审批与 schema 校验。",
    why: "只在执行前问一次 allow/deny 不够：被拒绝的工具仍出现在 prompt 会诱导模型调用；只在建目录时过滤也不够，因为 Hook 可能重写路径，审批可能只允许某组参数。OpenClaw 因此有两道门：tool surface 先按 profile、provider、agent、group、sender 和 runtime policy 逐层收窄；具体调用再对 Hook 修改后的最终参数重新验证，Hook 失败默认阻断。",
    model: "像园区门禁加实验室审批：园区门禁决定你能看到哪些楼，实验室门口再检查这一次携带的样品、操作参数和负责人签字。",
    flow: ["Construct tool candidates", "Layered surface filter", "Prepare call params", "Trusted policy + approval", "Plugin hook rewrite", "Final validate + execute"],
    files: ["src/agents/agent-tools.ts", "src/agents/tool-policy-pipeline.ts", "src/agents/agent-tools.before-tool-call.policy.ts", "src/agents/agent-tools.before-tool-call.wrapper.ts"],
    code: `// concept sketch\nvisible = applyPolicyLayers(allTools, profile, provider, agent, group, sender)\nparams = prepare(rawArgs)\nparams = await trustedPolicyAndApproval(params)\nparams = await pluginHook(params)\nvalidate(finalize(params))\nreturn execute(params)`,
    points: ["不可用能力先从 prompt 消失", "审批绑定最终参数", "Hook 异常 fail closed"],
    takeaway: "安全工具系统要区分‘是否展示这个能力’与‘是否允许这一次副作用’，并明确每层是否只能收窄、能否重写、失败如何处理。",
  },
  {
    id: "O08", group: "扩展边界", groupColor: "#25ad7c", title: "Harness 插件：清单先激活，Registry 再选执行世界", kicker: "Manifest / Ownership / Fail Closed",
    motto: "Gateway 先从 manifest 与配置计算需要激活的 runtime 插件；插件注册唯一 harness id，selection 只从活动 registry 选择，显式插件 runtime 不支持时拒绝回退。",
    why: "真正可维护的插件系统不能在每个请求里扫描磁盘，也不能让两个插件抢同一个 runtime id，更不能在指定 Codex/Copilot 失败后悄悄改用 OpenClaw。源码把控制面和运行面分开：manifest-first startup 只激活配置需要的插件；registrar 验证 supports/runAttempt 与所有权；selection 中只有 auto 未匹配时才回落 built-in，显式插件路径 fail closed。",
    model: "像航空牌照系统：航司先凭清单获准进入机场，再注册唯一呼号；调度只能选择已注册航司。旅客点名某航司时，停飞应明确报错，而不是暗中换一家公司。",
    flow: ["Read manifest metadata", "Plan startup activation", "Register owned harness id", "Build support candidates", "Explicit fail closed / auto fallback", "Dispose on reload"],
    files: ["src/plugins/gateway-startup-plugin-plan.ts", "src/plugins/registry-registrars-providers.ts", "src/agents/harness/registry.ts", "src/agents/harness/selection.ts", "src/plugin-sdk/agent-harness.ts"],
    code: `// concept sketch\nactivatePlugins(requiredHarnessRuntimes)\nregistry.registerAgentHarness({ id, supports, runAttempt })\nif (runtime === "auto") return bestSupported() ?? builtin\nreturn requireSupportedExplicitRuntime(runtime)`,
    points: ["发现不等于执行", "runtime id 有唯一所有者", "只有 auto 允许兼容回落"],
    takeaway: "插件扩展的关键不是动态 import，而是激活计划、所有权、公开 SDK、选择语义和 reload 清理共同形成可验证边界。",
  },
];

const lessonDetails: Record<string, LessonDetail> = {
  C01: {
    architecture: "cli.tsx 把模块加载本身当作产品边界：performance shim 必须先执行，--version 零额外依赖；ACP、Chrome native、computer-use、daemon、remote、autonomy、tmux/worktree 等进程角色各自在匹配 argv 后动态加载并终止。只有走默认路径时才先应用 --bare 等早期环境语义，再 import main.tsx。",
    evidence: [
      { file: "src/entrypoints/cli.tsx", symbol: "module prelude", lineStart: 1, lineEnd: 5, kind: "代码事实", note: "performance shim 被要求为第一条 import；注释把顺序与长会话内存行为直接关联，说明 import graph 是运行语义而非格式偏好。" },
      { file: "src/entrypoints/cli.tsx", symbol: "--version fast path", lineStart: 71, lineEnd: 84, kind: "代码事实", note: "版本查询在加载主程序前直接返回，源码明确称其为 zero-import fast path。" },
      { file: "src/entrypoints/cli.tsx", symbol: "protocol / worker fast paths", lineStart: 86, lineEnd: 240, kind: "代码事实", note: "profiler、ACP、native messaging、computer use、daemon worker、bridge 与 remote 等角色只动态加载自己需要的模块并终止。" },
      { file: "src/entrypoints/cli.tsx", symbol: "bare gate / main import", lineStart: 346, lineEnd: 359, kind: "代码事实", note: "--bare 必须在 main 模块求值前写入环境并捕获早期输入，之后才动态导入完整主入口。" },
    ],
    trace: [
      { name: "module prelude", input: "Node/Bun 进程刚启动", responsibility: "先安装性能/内存 shim，避免后续模块在错误环境求值。", output: "可安全检查 argv 的轻进程", anchor: "cli.tsx · L1" },
      { name: "fast-path matcher", input: "process.argv", responsibility: "识别只需一个子系统的进程角色，并在该分支完成生命周期。", output: "版本文本或专用 worker/protocol 运行", anchor: "cli.tsx · L71" },
      { name: "early env gate", input: "默认产品参数与 --bare", responsibility: "在完整模块加载前冻结会影响模块初始化的环境语义。", output: "主程序可读取的一致启动环境", anchor: "cli.tsx · L346" },
      { name: "dynamic main", input: "未被 fast path 消费的 argv", responsibility: "此时才加载 Commander、React Ink、工具与完整服务图。", output: "REPL、print、resume 等产品形态", anchor: "cli.tsx · L358" },
    ],
  },
  C02: {
    architecture: "当前实现有两种产品外壳：REPL.tsx 直接构造 prompt/system/tool context、调用 query()，用 onQueryEvent、useLogMessages、QueryGuard 与 React state 管交互；headless/SDK 的 QueryEngine 则跨 submitMessage 持有 mutableMessages、usage、permission denials 与 file cache，ACP 明确构造它。两者共享 query/queryLoop，但源码注释把 REPL 迁入 QueryEngine 标成 future phase。",
    evidence: [
      { file: "src/QueryEngine.ts", symbol: "QueryEngine ownership contract", lineStart: 183, lineEnd: 215, kind: "代码事实", note: "类注释明确限定 headless/SDK，并称 REPL 为 future phase；字段列出跨 turn 的 messages、usage、denials 与 file cache。" },
      { file: "src/services/acp/agent/createSessionMethod.ts", symbol: "ACP session construction", lineStart: 180, lineEnd: 195, kind: "代码事实", note: "ACP 组装 mcp、permissions、AppState 与 FileStateCache 后，真实构造一份 QueryEngine。" },
      { file: "src/screens/REPL.tsx", symbol: "REPL onQuery", lineStart: 3499, lineEnd: 3523, kind: "代码事实", note: "REPL 自己构建 effective system prompt，并直接 for-await query()；事件交给 onQueryEvent，而非经 QueryEngine。" },
      { file: "src/screens/REPL.tsx", symbol: "REPL persistence / queue", lineStart: 4755, lineEnd: 4839, kind: "代码事实", note: "REPL 的 transcript hook、bridge、queued input 与 QueryGuard 都由组件拥有，证明产品壳并未迁入 QueryEngine。" },
    ],
    trace: [
      { name: "REPL shell", input: "输入框、AppState、MCP clients 与 React refs", responsibility: "构造本轮上下文，直接运行 query，并把事件归约到 UI/日志。", output: "Ink 状态与本地 transcript", anchor: "REPL.tsx · L3499" },
      { name: "ACP / SDK shell", input: "session config 与连续 submitMessage", responsibility: "跨 turn 保存消息、usage、权限拒绝和文件缓存，并投影 SDK 事件。", output: "SDKMessage stream", anchor: "QueryEngine.ts · L183" },
      { name: "query()", input: "任一外壳准备好的 messages/system/tools", responsibility: "统一启动模型—工具循环并产出事件。", output: "共享的 Message/StreamEvent", anchor: "query.ts · query" },
      { name: "owner-specific commit", input: "query 事件", responsibility: "由各自外壳决定 React 归约、JSONL ack、usage 或 SDK 兼容格式。", output: "各入口的一致产品状态", anchor: "REPL.tsx · L4755 / QueryEngine.ts" },
    ],
  },
  C03: {
    architecture: "queryLoop 用单一 State 承载跨迭代变量，并在每次 model call 前从完整 messages 生成 messagesForQuery：compact boundary、raw toolUseResult、result budget、snip、microcompact、context collapse 与 autocompact 都是有顺序的读时投影。模型流可能生成 tombstone、withheld error 或 tool_use；恢复通过具名 transition 重写整个 State，而非散落变量。工具完成后才组装 next_turn State。",
    evidence: [
      { file: "src/query.ts", symbol: "queryLoop State", lineStart: 393, lineEnd: 460, kind: "代码事实", note: "immutable params 与 mutable cross-iteration State 被明确分开；所有 continue site 必须整体写回 messages、recovery guards、turnCount 与 transition。" },
      { file: "src/query.ts", symbol: "model-view projection pipeline", lineStart: 523, lineEnd: 733, kind: "代码事实", note: "发送前依次执行 boundary projection、raw result 脱附、预算、snip、microcompact、collapse 与 autocompact；多处强调不原地改 UI 的 mutableMessages。" },
      { file: "src/query.ts", symbol: "stream fallback reset", lineStart: 899, lineEnd: 980, kind: "代码事实", note: "流式降级会 tombstone 已输出的孤儿 assistant，清空 tool blocks/results，并 discard 旧 StreamingToolExecutor，防止旧 tool_use_id 的结果泄漏。" },
      { file: "src/query.ts", symbol: "overflow recovery transitions", lineStart: 1349, lineEnd: 1538, kind: "代码事实", note: "413 先尝试 collapse_drain_retry，再 reactive_compact_retry；max output 先原请求升限，再注入 continuation，且 guard 防止重复死循环。" },
      { file: "src/query.ts", symbol: "next-turn commit", lineStart: 1990, lineEnd: 2058, kind: "代码事实", note: "工具后可刷新 MCP tools，检查 maxTurns，再一次性构造 reason=next_turn 的完整 State。" },
    ],
    trace: [
      { name: "project model view", input: "完整 messages 与 token/runtime 状态", responsibility: "以固定次序删除或摘要模型不该再看的内容，不破坏产品消息真源。", output: "messagesForQuery", anchor: "query.ts · L523" },
      { name: "provider stream", input: "system、model view、tools 与 runtime options", responsibility: "产生 typed assistant/tool/error events；降级时回收上一尝试的孤儿状态。", output: "assistantMessages + toolUseBlocks", anchor: "query.ts · L899" },
      { name: "named recovery", input: "withheld 413、media error、max-output 或 stop hook", responsibility: "选择一次恢复动作并设置 guard/transition，避免相同失败无限重放。", output: "新的完整 State", anchor: "query.ts · L1349" },
      { name: "next-turn commit", input: "assistant messages、ordered tool results 与 updated context", responsibility: "刷新动态工具、递增 turn、检查上限后原子进入下一迭代。", output: "transition=next_turn", anchor: "query.ts · L2042" },
    ],
  },
  C04: {
    architecture: "Tool 契约不仅有 call/schema，还声明 isConcurrencySafe(input)、isReadOnly、isDestructive、interruptBehavior、defer/alwaysLoad、MCP metadata 与 result size。getAllBaseTools 是内置能力真源；runTools 依据已校验的具体 input 把连续安全调用组成 batch。安全 batch 的消息按完成顺序即时 yield，但 contextModifier 先按 toolUseID 排队，batch 结束后再按原 blocks 顺序提交；非安全调用逐个执行。",
    evidence: [
      { file: "src/Tool.ts", symbol: "Tool contract", lineStart: 373, lineEnd: 477, kind: "代码事实", note: "并发、只读、破坏性、打断、延迟加载、MCP 身份与大结果上限都是一等能力，而非 scheduler 内的工具名白名单。" },
      { file: "src/tools.ts", symbol: "getAllBaseTools", lineStart: 218, lineEnd: 284, kind: "代码事实", note: "内置工具表在一个函数集中组合，并按 feature gate 决定 SearchExtraTools/ExecuteTool 等产品能力。" },
      { file: "src/services/tools/toolOrchestration.ts", symbol: "runTools ordered modifiers", lineStart: 20, lineEnd: 96, kind: "代码事实", note: "并发结果立即 yield，但 context modifiers 先按 id 缓存，再依照 block 原顺序应用；串行分支则即时更新 currentContext。" },
      { file: "src/services/tools/toolOrchestration.ts", symbol: "partitionToolCalls / concurrent pool", lineStart: 101, lineEnd: 195, kind: "代码事实", note: "scheduler 对每个输入 safeParse 后调用 isConcurrencySafe；异常保守返回 false，连续安全调用合批，并发上限默认 10。" },
    ],
    trace: [
      { name: "capability lookup", input: "tool_use name + raw input", responsibility: "找到 Tool 并用 schema 解析，以真实参数计算并发安全性。", output: "safe / unsafe block", anchor: "toolOrchestration.ts · L101" },
      { name: "adjacent partition", input: "模型给出的 tool_use 顺序", responsibility: "只合并相邻安全调用；每个非安全调用形成独立串行 batch。", output: "ordered batches", anchor: "toolOrchestration.ts · L124" },
      { name: "concurrent stream", input: "safe batch 与同一 context snapshot", responsibility: "最多并发 10 个调用，让进度和结果按实际完成时间可见。", output: "messages + queued modifiers", anchor: "toolOrchestration.ts · L169" },
      { name: "deterministic commit", input: "按 toolUseID 缓存的 context modifiers", responsibility: "按模型 block 顺序修改 context，隔离执行时序抖动。", output: "stable currentContext", anchor: "toolOrchestration.ts · L67" },
    ],
  },
  C05: {
    architecture: "checkPermissionsAndCallTool 把模型输入依次转成：Zod-valid input、工具语义 valid input、剥离内部伪造字段的 processedInput、供 hooks/permission 观察的 backfilled clone、最终获准的 call input。PreToolUse 可更新输入、附加上下文或阻止继续，但 resolveHookPermissionDecision 规定 hook allow 仍受 deny/ask 规则约束；只有最终 behavior=allow 才进入 tool.call。",
    evidence: [
      { file: "src/services/tools/toolExecution.ts", symbol: "schema + semantic validation", lineStart: 641, lineEnd: 775, kind: "代码事实", note: "Zod 类型错误与 tool.validateInput 语义错误分别归一化为带同一 tool_use_id 的 error result，避免模型历史出现悬空调用。" },
      { file: "src/services/tools/toolExecution.ts", symbol: "defense-in-depth input split", lineStart: 776, lineEnd: 835, kind: "代码事实", note: "Bash classifier 可提前并行；模型提供的内部 _simulatedSedEdit 被剥离；observer backfill 使用 clone，默认不改变真正 call input。" },
      { file: "src/services/tools/toolExecution.ts", symbol: "PreToolUse integration", lineStart: 837, lineEnd: 904, kind: "代码事实", note: "Hook 可以发进度、给权限决定、更新输入、阻止 continuation、补上下文或停止；所有返回都进入正式执行状态机。" },
      { file: "src/services/tools/toolHooks.ts", symbol: "resolveHookPermissionDecision", lineStart: 340, lineEnd: 440, kind: "代码事实", note: "hook allow 只在无更强规则时生效；deny rule 覆盖，ask rule 仍调用 canUseTool，interactive 或 requireCanUseTool 也不能被绕过。" },
      { file: "src/services/tools/toolExecution.ts", symbol: "permission gate / call boundary", lineStart: 958, lineEnd: 1045, kind: "代码事实", note: "统一决策在 span/telemetry 中记录；非 allow 路径生成拒绝结果并在真实 tool.call 前返回。" },
    ],
    trace: [
      { name: "schema gate", input: "模型生成的 JSON input", responsibility: "做结构校验；失败仍生成可回填的 tool_result。", output: "typed input 或 InputValidationError", anchor: "toolExecution.ts · L656" },
      { name: "semantic + sanitize", input: "typed input 与 ToolUseContext", responsibility: "运行工具私有约束，剥离内部字段，并创建只供观察者使用的派生副本。", output: "processedInput + callInput", anchor: "toolExecution.ts · L724" },
      { name: "hook + permission lattice", input: "processedInput、hook decision、rules 与运行模式", responsibility: "允许修改和建议，但保证 deny/ask/interaction 的优先级不可被弱授权覆盖。", output: "final PermissionDecision", anchor: "toolHooks.ts · L340" },
      { name: "side-effect boundary", input: "behavior=allow 与最终执行输入", responsibility: "此处之后才启动真实工具执行；拒绝路径保持协议完整但无副作用。", output: "ToolResult / PostToolUse", anchor: "toolExecution.ts · L1220" },
    ],
  },
  C06: {
    architecture: "上下文不是单一 builder。buildEffectiveSystemPrompt 处理系统身份的替换/追加优先级；getSystemContext 生成并 memoize 会话开局 Git 快照；getUserContext 读取 CLAUDE.md 与日期。getMemoryFiles 又按 Managed、User、Project、Local 顺序加载，从根目录向 cwd 递进，跟踪 include、source 与项目设置；getClaudeMds 最后为每份内容保留路径和类型说明。",
    evidence: [
      { file: "src/utils/systemPrompt.ts", symbol: "buildEffectiveSystemPrompt", lineStart: 28, lineEnd: 120, kind: "代码事实", note: "override、coordinator、agent、custom、default 和 append 的优先级逐项写明；agent 在普通模式替换 default，proactive 模式才追加。" },
      { file: "src/context.ts", symbol: "getSystemContext / getUserContext", lineStart: 113, lineEnd: 188, kind: "代码事实", note: "system context 将 Git status 当会话缓存快照；user context 独立发现 CLAUDE.md、写入 classifier cache 并附加当前日期。" },
      { file: "src/utils/claudemd.ts", symbol: "memory ordering / include contract", lineStart: 1, lineEnd: 25, kind: "代码事实", note: "文件顶部定义 Managed→User→Project→Local、root→cwd 以及 include/cycle 规则，提供明确来源契约。" },
      { file: "src/utils/claudemd.ts", symbol: "getMemoryFiles", lineStart: 789, lineEnd: 933, kind: "代码事实", note: "loader 先处理托管和用户规则，再由根向 cwd 读取 Project/Local；worktree 还避免主仓与工作树的 checked-in 指令重复注入。" },
      { file: "src/utils/claudemd.ts", symbol: "getClaudeMds", lineStart: 1152, lineEnd: 1194, kind: "代码事实", note: "最终文本仍为每个文件标注路径与 Project/Local/AutoMem 等来源语义，而非无来源拼接。" },
    ],
    trace: [
      { name: "system identity priority", input: "override/coordinator/agent/custom/default", responsibility: "决定替换还是追加，形成稳定 SystemPrompt 数组。", output: "systemPrompt", anchor: "systemPrompt.ts · L28" },
      { name: "environment snapshot", input: "会话启动时 cwd 与 Git 仓库", responsibility: "并行收集 branch/status/log/user，再 memoize 为不随工具编辑漂移的开局事实。", output: "systemContext.gitStatus", anchor: "context.ts · L116" },
      { name: "memory discovery", input: "setting sources、cwd、include approval", responsibility: "按来源和目录距离收集文本，避免循环 include 与 worktree 重复。", output: "MemoryFileInfo[]", anchor: "claudemd.ts · L789" },
      { name: "source-preserving render", input: "ordered memory files", responsibility: "为每段内容保留路径/类型说明，再进入 user context。", output: "claudeMd string", anchor: "claudemd.ts · L1152" },
    ],
  },
  C07: {
    architecture: "autoCompact 用模型窗口、snip 差额、query source recursion guard 与 circuit breaker 决定是否进入 compactConversation。compact 生成 boundaryMarker、summary、messagesToKeep、attachments 与 hooks；messagesToKeep 已经存在于 JSONL，recordTranscript 以 UUID 去重，boundary 因此携带 preservedSegment 的 head/anchor/tail。读取时 applyPreservedSegmentRelinks 验证并修补端点，buildConversationChain 沿 parentUuid 回溯，再恢复并行 tool_use 形成的 DAG 旁支。",
    evidence: [
      { file: "src/services/compact/autoCompact.ts", symbol: "shouldAutoCompact / circuit breaker", lineStart: 189, lineEnd: 350, kind: "代码事实", note: "forked compact sources 有递归 guard；阈值来自模型窗口；连续失败有熔断，并优先尝试 session-memory compaction。" },
      { file: "src/services/compact/compact.ts", symbol: "post-compact projection / relink metadata", lineStart: 336, lineEnd: 390, kind: "代码事实", note: "模型视图顺序是 boundary、summary、kept suffix、attachments、hooks；preservedSegment 只保存端点 UUID，不改写旧消息。" },
      { file: "src/utils/sessionStorage.ts", symbol: "recordTranscript UUID dedup", lineStart: 1428, lineEnd: 1485, kind: "代码事实", note: "已记录消息只有在新消息之前形成 prefix 时才推进 parent cursor；compact 后位于新 boundary/summary 之后的 kept messages 不会把链重新接回旧前缀。" },
      { file: "src/utils/sessionStorage.ts", symbol: "applyPreservedSegmentRelinks", lineStart: 1860, lineEnd: 1935, kind: "代码事实", note: "恢复先验证 tail→head 完整；若 UUID 缺失则放弃 prune，宁可返回完整 pre-compact history，避免静默丢失。" },
      { file: "src/utils/sessionStorage.ts", symbol: "buildConversationChain / parallel result recovery", lineStart: 2100, lineEnd: 2245, kind: "代码事实", note: "基础链检测 parent cycle；后处理再按共享 assistant message.id 找回并行 tool_use sibling 与各自 tool_result。" },
    ],
    trace: [
      { name: "compact admission", input: "模型窗口、messages、querySource 与失败计数", responsibility: "避免 fork 递归/死亡重试，并在超过有效阈值时选择压缩路径。", output: "CompactionResult 或 no-op", anchor: "autoCompact.ts · L189" },
      { name: "boundary projection", input: "summary、recent suffix、attachments 与 hook results", responsibility: "形成新的模型可见前缀，并把保留段端点写入 compact metadata。", output: "postCompactMessages", anchor: "compact.ts · L336" },
      { name: "append-only record", input: "boundary + summary + already-written suffix", responsibility: "按 UUID 去重且只让真正的新 chain participant 推进磁盘 parent。", output: "JSONL 新条目", anchor: "sessionStorage.ts · L1445" },
      { name: "resume relink + DAG repair", input: "全部 JSONL entries 与 leaf", responsibility: "验证保留段、修两端、沿 parent 回溯并补回并行 tool/result 旁支。", output: "API 合法的恢复链", anchor: "sessionStorage.ts · L1876 / L2106" },
    ],
  },
  C08: {
    architecture: "MCP client 把外部 server tool 适配为完整内部 Tool：annotation 映射并发/只读/破坏性/open-world，schema 原样保留，permission 默认 passthrough，call 路径拥有进度、session-expiry 重连、elicitation 与结果规范化。连接发现又按 local process 与 remote network 分开限流。Plugin loader 则将 marketplace/session/builtin 资源解析为 commands、agents、skills、styles、hooks，并执行 managed policy 与确定优先级。queryLoop 在工具轮次间 refreshTools，使后来连接的 MCP 能力进入下一轮。",
    evidence: [
      { file: "src/services/mcp/client.ts", symbol: "fetchToolsForClient adapter", lineStart: 1756, lineEnd: 1844, kind: "代码事实", note: "MCP tool 被转成内部 Tool，annotation 决定并发、readOnly、destructive 与 openWorld，schema/permission 也进入统一契约。" },
      { file: "src/services/mcp/client.ts", symbol: "MCP call / session recovery", lineStart: 1845, lineEnd: 1983, kind: "代码事实", note: "执行拥有 start/completed/failed 进度、abort、elicitation、结构化结果，并在 MCP session expired 时仅重试一次。" },
      { file: "src/services/mcp/client.ts", symbol: "getMcpToolsCommandsAndResources", lineStart: 2238, lineEnd: 2415, kind: "代码事实", note: "disabled 与 needs-auth 都成为显式连接状态；local/remote server 分组并发，connected 后并行发现 tools、commands、skills 与 resources。" },
      { file: "src/utils/plugins/pluginLoader.ts", symbol: "createPluginFromPath", lineStart: 1349, lineEnd: 1770, kind: "代码事实", note: "manifest 经 schema 验证后，commands/agents/skills/styles 路径并行检查，hooks 去重合并，错误以 component 级记录返回。" },
      { file: "src/utils/plugins/pluginLoader.ts", symbol: "mergePluginSources", lineStart: 3012, lineEnd: 3066, kind: "代码事实", note: "managed settings 优先于 --plugin-dir；其余同名资源按 session > marketplace > builtin 决定 first-match。" },
      { file: "src/query.ts", symbol: "refreshTools between turns", lineStart: 1990, lineEnd: 2000, kind: "代码事实", note: "一个工具批次完成后才获取新 tools snapshot，让新连上的 MCP 能力在下一次模型请求可见。" },
    ],
    trace: [
      { name: "source admission", input: "MCP configs 或 plugin marketplace/session paths", responsibility: "识别 disabled/auth/policy 状态，验证 manifest 与路径。", output: "admitted source records", anchor: "mcp/client.ts · L2238 / pluginLoader.ts · L1349" },
      { name: "capability translation", input: "MCP protocol schema/annotations 或 plugin components", responsibility: "映射到内部 Tool/Command/Agent/Skill/Hook 表面，不让 loop 理解外部协议细节。", output: "internal capabilities", anchor: "mcp/client.ts · L1756" },
      { name: "precedence + resource budget", input: "多个插件来源、本地进程与远程 server", responsibility: "执行企业策略与来源覆盖；对本地 spawn、远程连接使用不同并发预算。", output: "稳定 product state", anchor: "pluginLoader.ts · L3012 / mcp/client.ts · L2400" },
      { name: "turn-boundary refresh", input: "工具执行后的最新 MCP state", responsibility: "只在进入下一轮前替换 tools snapshot，避免运行中请求被半途改表。", output: "下一轮可见 tools", anchor: "query.ts · L1990" },
    ],
  },
  O01: {
    architecture: "真实主链是 Channel adapter → runChannelTurn → route/session → Harness selection → runAttempt → agent-core → delivery settlement。每一层接收上一层已经确认的事实，并只补充自己拥有的决定：渠道不选模型，core 不猜外部身份，Harness 不拥有渠道回执，delivery 不重跑推理。",
    evidence: [
      { file: "src/channels/turn/run-channel-turn.ts", symbol: "runChannelTurn", lineStart: 143, lineEnd: 245, kind: "代码事实", note: "渠道主链先 ingest、classify、preflight，再 resolve/assemble route；未获 dispatch admission 的事件不会进入 Agent runtime。" },
      { file: "src/agents/harness/selection.ts", symbol: "selectAgentHarnessDecision", lineStart: 279, lineEnd: 314, kind: "代码事实", note: "Harness 选择发生在 provider/model 与 prepared route 已确定之后；built-in OpenClaw 与插件候选被显式分开。" },
      { file: "src/agents/harness/builtin-openclaw.ts", symbol: "createOpenClawAgentHarness", lineStart: 68, lineEnd: 105, kind: "代码事实", note: "内置 runtime 也实现统一 AgentHarness 合同：runAttempt 指向 embedded runner，isolated completion 与 settled-turn finalization 各有独立入口。" },
      { file: "src/agents/runtime/index.ts", symbol: "OpenClaw runtime facade", lineStart: 1, lineEnd: 28, kind: "代码事实", note: "产品侧通过门面重新导出 Agent、runAgentLoop、compaction 与 session helpers，而不是让每个调用方直接拼 agent-core 内部路径。" },
    ],
    trace: [
      { name: "Channel admission", input: "平台原生事件", responsibility: "规范化、分类并拒绝无需启动 Agent 的事件。", output: "可路由的 NormalizedTurnInput", anchor: "run-channel-turn.ts · L143" },
      { name: "Route + session", input: "channel/account/peer 与配置", responsibility: "固化 agentId、session key 和记录目标。", output: "已归属的 turn", anchor: "run-channel-turn.ts · L230" },
      { name: "Harness selection", input: "prepared provider/model route", responsibility: "决定由 built-in 或已注册插件 runtime 执行。", output: "AgentHarness", anchor: "selection.ts · L279" },
      { name: "Attempt + core", input: "产品上下文、工具与模型快照", responsibility: "Runner 组装现实条件，core 推进模型—工具状态机。", output: "结构化运行结果", anchor: "builtin-openclaw.ts · L68" },
      { name: "Delivery owner", input: "reply payloads", responsibility: "完成平台发送、回执结算和可见性判断。", output: "外部可观察终态", anchor: "lifecycle.ts · L419" },
    ],
  },
  O02: {
    architecture: "Agent 类拥有可观察 state、listener、steering/follow-up queue 与 activeRun；runLoop 以外层 follow-up loop 包住内层 tool/steering loop。模型流先形成 assistant message，只有 stopReason=toolUse 的完整工具轮次才执行；并行实现用 Promise.all 执行，却按原 toolCalls 数组生成 orderedFinalizedCalls 和 transcript result。",
    evidence: [
      { file: "packages/agent-core/src/agent.ts", symbol: "Agent state and queues", lineStart: 214, lineEnd: 287, kind: "代码事实", note: "Agent 明确拥有 steering/follow-up 两只队列、监听器、activeRun 与 toolExecution；默认多工具执行策略为 parallel。" },
      { file: "packages/agent-core/src/agent.ts", symbol: "prompt / continue", lineStart: 398, lineEnd: 445, kind: "代码事实", note: "activeRun 时 prompt 拒绝重入；continue 会优先消耗 queued steering，再消耗 follow-up，最后才执行 transcript continuation。" },
      { file: "packages/agent-core/src/agent-loop.ts", symbol: "nested runLoop", lineStart: 345, lineEnd: 420, kind: "代码事实", note: "源码注释直接标出 outer follow-up loop 与 inner tool/steering loop；pending message 在下一次模型请求前作为正式事件和上下文消息提交。" },
      { file: "packages/agent-core/src/agent-loop.ts", symbol: "parallel execution and ordered results", lineStart: 1034, lineEnd: 1110, kind: "代码事实", note: "工具实现用 Promise.all 并发，但结果先保存在与原调用对应的数组，之后才按数组顺序 emit ToolResultMessage。" },
      { file: "packages/agent-core/src/agent-loop.ts", symbol: "next-turn and follow-up checkpoints", lineStart: 458, lineEnd: 519, kind: "代码事实", note: "prepareNextTurn 可原子替换 context/model/reasoning；steering 在 stop 判断前再次检查，follow-up 只在内层循环结束后进入。" },
    ],
    trace: [
      { name: "Agent.prompt", input: "新的用户消息或排队输入", responsibility: "建立 activeRun，快照 state 并启动事件驱动 loop。", output: "agent_start / turn_start", anchor: "agent.ts · L398" },
      { name: "streamAssistantResponse", input: "当前模型上下文与可见工具", responsibility: "把增量流归约成带 stopReason 的正式 assistant message。", output: "AssistantMessage", anchor: "agent-loop.ts · L526" },
      { name: "executeToolCalls", input: "完整 toolUse turn", responsibility: "选择 sequential/parallel，处理 steering skip 和工具生命周期。", output: "保序 ToolResultMessage[]", anchor: "agent-loop.ts · L629" },
      { name: "outer checkpoint", input: "本轮结果与两只消息队列", responsibility: "决定继续工具轮、注入 steering、启动 follow-up 或结束。", output: "下一 turn 或 agent_end", anchor: "agent-loop.ts · L458" },
    ],
  },
  O03: {
    architecture: "runEmbeddedAgent 先回填 session identity，再创建 session lane 与 global lane；同会话 maintenance 完成后才进入全局 admission。随后取得 prepared runtime lease，并把 config/workspace/model/plugin registry 全部重绑到 owner snapshot。runPreparedEmbeddedLoop 用显式 retry budget 驱动 prepare→dispatch→normalize→recover→terminal，finally 释放 context-engine 与 MCP runtime。",
    evidence: [
      { file: "src/agents/embedded-agent-runner/run-orchestrator.ts", symbol: "identity and lane controller", lineStart: 101, lineEnd: 163, kind: "代码事实", note: "sessionKey 在任何 hook/compaction 前补齐；session lane 与 global lane 独立建立，失败 suspension 也绑定明确 lane owner。" },
      { file: "src/agents/embedded-agent-runner/run-orchestrator.ts", symbol: "session then global admission", lineStart: 182, lineEnd: 203, kind: "代码事实", note: "同会话先等待 deferred maintenance，再进入 global lane；CLI backend 也在相同 admission、placement 与 concurrency gate 后分流。" },
      { file: "src/agents/embedded-agent-runner/run-orchestrator.ts", symbol: "prepared runtime lease", lineStart: 250, lineEnd: 300, kind: "代码事实", note: "运行请求取得 exact writable 或 isolated read-only lease，并把 config、目录、模型选择、hooks 与 fallback 重新绑定到已提交 owner generation。" },
      { file: "src/agents/embedded-agent-runner/run-loop.ts", symbol: "bounded retry state machine", lineStart: 315, lineEnd: 465, kind: "代码事实", note: "每次循环先检查 retry budget，再 prepare/dispatch、normalize、recover；retry 统一记录 kind，超限返回 blocked terminal 而非继续旋转。" },
      { file: "src/agents/embedded-agent-runner/run-loop.ts", symbol: "terminal cleanup", lineStart: 665, lineEnd: 714, kind: "代码事实", note: "无论怎样结束，都清 prompt/provider state、停止 auth timer、dispose context-engine lease，并按所有权退休 session MCP runtime。" },
    ],
    trace: [
      { name: "identity admission", input: "可能缺 sessionKey 的 RunEmbeddedAgentParams", responsibility: "补齐 agent/session target，拒绝不合法 Harness admission。", output: "RunParamsWithSessionFile", anchor: "run-orchestrator.ts · L101" },
      { name: "lane controller", input: "sessionKey 与 requested lane", responsibility: "同会话串行、跨会话受全局并发约束，并报告等待进度。", output: "获准启动的 run closure", anchor: "run-orchestrator.ts · L150" },
      { name: "runtime lease", input: "agent/config/workspace 与候选 route", responsibility: "锁定一个完整 generation，并把请求重绑到其事实。", output: "PreparedModelRuntimeSnapshot", anchor: "run-orchestrator.ts · L250" },
      { name: "retry loop", input: "prepared runtime 与当前恢复状态", responsibility: "有界处理 auth/fallback/overflow/timeout/terminal finalization。", output: "EmbeddedAgentRunResult", anchor: "run-loop.ts · L315" },
      { name: "cleanup owner", input: "成功、失败、超时或取消", responsibility: "释放 context-engine、prompt cache、auth timer 与 MCP 资源。", output: "无悬挂运行资源", anchor: "run-loop.ts · L665" },
    ],
  },
  O04: {
    architecture: "runChannelTurn 把渠道轮次拆为 ingest/classify/preflight/assemble/finalize；PreparedChannelTurn 又把 record 与 dispatch 分开。delivery owner 包装 buffered dispatcher，统一处理 direct send、durable queue、message_sent hook、provider finalization 和 partial-delivery error，避免把‘Agent 已结束’误当成‘用户已收到’。",
    evidence: [
      { file: "src/channels/turn/run-channel-turn.ts", symbol: "ingest / classify / preflight", lineStart: 143, lineEnd: 228, kind: "代码事实", note: "null ingest、非 Agent event、handled 与 drop 都有结构化 admission；drop 还能按 policy 记录 channel history。" },
      { file: "src/channels/turn/run-channel-turn.ts", symbol: "assemble and dispatch variants", lineStart: 230, lineEnd: 279, kind: "代码事实", note: "resolved turn 被分成 prepared、routed 与 assembled 三种执行路径，但都保留同一 admission、ctxPayload 与 routeSessionKey。" },
      { file: "src/channels/turn/execution.ts", symbol: "record before dispatch", lineStart: 218, lineEnd: 323, kind: "代码事实", note: "入站 session/transcript context 先合并并 record；只有记录成功后才进入 runDispatch，observeOnly 也有显式 skip 生命周期。" },
      { file: "src/channels/turn/lifecycle.ts", symbol: "delivery owner", lineStart: 419, lineEnd: 592, kind: "代码事实", note: "出站 payload 可先 prepare/suppress，再尝试 durable delivery、provider-owned send 或 direct deliver；每一种结果都进入 observer 与可见性统计。" },
      { file: "src/channels/turn/lifecycle.ts", symbol: "deferred settlement precedence", lineStart: 612, lineEnd: 640, kind: "代码事实", note: "等待所有 deferred finalization 后，若 settlement error 已包含 provider-visible partial result，它优先于早期 dispatch error，避免重复发送已被平台接受的消息。" },
    ],
    trace: [
      { name: "adapter.ingest", input: "平台 raw event", responsibility: "翻译为统一消息；无效输入立刻产生 drop。", output: "NormalizedTurnInput", anchor: "run-channel-turn.ts · L163" },
      { name: "preflight", input: "消息与 event class", responsibility: "处理 handled/drop/observeOnly/dispatch，阻止无意义运行。", output: "ChannelTurnAdmission", anchor: "run-channel-turn.ts · L205" },
      { name: "session record", input: "route 与 ctxPayload", responsibility: "先提交入站事实和 last-route，再启动 Agent。", output: "durable inbound session state", anchor: "execution.ts · L237" },
      { name: "reply dispatcher", input: "Agent payload stream", responsibility: "按渠道能力准备、抑制或发送 tool/block/final payload。", output: "delivery attempts", anchor: "lifecycle.ts · L443" },
      { name: "settlement", input: "立即结果与 deferred finalization", responsibility: "合并回执、可见性和部分成功，决定是否可重试。", output: "ChannelTurnResult", anchor: "lifecycle.ts · L612" },
    ],
  },
  O05: {
    architecture: "resolveAgentRoute 先规范化 channel/account/peer/guild/team，再从分层索引中按优先级找第一条 scope match；choose() 才把 agentId 与 dmScope 交给 buildAgentSessionKey。session-key 层区分 main、per-peer、per-channel-peer、per-account-channel-peer 与 group/channel/thread，并对畸形 agent: 前缀 fail closed。",
    evidence: [
      { file: "src/routing/resolve-route.ts", symbol: "buildAgentSessionKey", lineStart: 87, lineEnd: 109, kind: "代码事实", note: "route 层只把已解析 agent、channel、account、peer 与 dmScope 交给 session-key builder，不在调用点散落字符串格式。" },
      { file: "src/routing/resolve-route.ts", symbol: "resolveAgentRoute.choose", lineStart: 577, lineEnd: 664, kind: "代码事实", note: "choose() 同时产出 agentId、sessionKey、mainSessionKey、lastRoutePolicy 与 matchedBy，并对稳定输入使用有界 route cache。" },
      { file: "src/routing/resolve-route.ts", symbol: "binding tiers", lineStart: 691, lineEnd: 774, kind: "代码事实", note: "真实匹配顺序是 peer、parent peer、peer wildcard、guild+roles、guild、team、account、channel，最后才默认 Agent。" },
      { file: "src/routing/session-key.ts", symbol: "malformed agent key rejection", lineStart: 114, lineEnd: 165, kind: "代码事实", note: "store key 统一加 agent scope；形如 agent: 但无法解析的 key 被分类为 malformed_agent，并拒绝回落默认 Agent。" },
      { file: "src/routing/session-key.ts", symbol: "buildAgentPeerSessionKey", lineStart: 211, lineEnd: 263, kind: "代码事实", note: "direct chat 的四种 dmScope 产生不同隔离粒度；group/channel 始终编码 channel、peer kind 与规范化 peer id。" },
    ],
    trace: [
      { name: "normalize identity", input: "原生 channel/account/peer/guild/team", responsibility: "消除大小写与别名差异，建立稳定匹配输入。", output: "BindingScope", anchor: "resolve-route.ts · L577" },
      { name: "binding index", input: "配置中的 bindings", responsibility: "按 peer/guild/team/account/channel 建索引并保留来源顺序。", output: "tier candidates", anchor: "resolve-route.ts · L359" },
      { name: "first matching tier", input: "当前 scope 与候选集", responsibility: "选择 Agent，并把 matchedBy 保存在 route 结果。", output: "agentId + dmScope", anchor: "resolve-route.ts · L698" },
      { name: "session key builder", input: "agentId、dmScope 与 peer", responsibility: "编码 main/direct/group/channel 隔离边界。", output: "canonical sessionKey", anchor: "session-key.ts · L211" },
      { name: "store guard", input: "外部或 legacy session key", responsibility: "补 agent scope，拒绝畸形 agent namespace。", output: "安全 store key 或错误", anchor: "session-key.ts · L114" },
    ],
  },
  O06: {
    architecture: "owners map 保存按 lifecycle identity 划分的不可变 snapshot；pendingModelRuntimeReplacement 是跨 owner 的可见性闸门。load/acquire 在闸门存在时等待并重绑 committed owner，refresh 先同步 stale，再按 epoch 构建整批候选，成功后清 gate 并通知 published；失败则让整批 owner 保持不可读。leaseCount 与 owner identity 共同保证安全回收。",
    evidence: [
      { file: "src/agents/prepared-model-runtime.ts", symbol: "loadPreparedModelRuntimeSnapshot", lineStart: 80, lineEnd: 137, kind: "代码事实", note: "任何 pending replacement 都先被 await；独立 activation 完成后若又出现 replacement，读者再次等待和重绑，不暴露竞态窗口。" },
      { file: "src/agents/prepared-model-runtime.ts", symbol: "acquirePreparedModelRuntimeLease", lineStart: 271, lineEnd: 391, kind: "代码事实", note: "acquire 验证 published owner 与 snapshot identity、stale/pending 状态；release 只有在 owner 仍是同一对象且无 retention 时才删除。" },
      { file: "src/agents/prepared-model-runtime.ts", symbol: "prepareModelRuntimeSnapshot", lineStart: 409, lineEnd: 455, kind: "代码事实", note: "read path 不自行发现或修复配置；replacement、refresh、read-only config mismatch 都会等待或 fail closed，只返回 lifecycle owner 发布的快照。" },
      { file: "src/agents/prepared-model-runtime.ts", symbol: "transactional refresh", lineStart: 588, lineEnd: 648, kind: "代码事实", note: "refresh 同步标 stale，串行 build、drain auth mutations、rebuild reply dispatch，最后才 resolve gate；失败会污染隔离整批 owner，而不是保留部分新状态。" },
      { file: "src/agents/prepared-model-runtime.ts", symbol: "auth mutation invalidation", lineStart: 691, lineEnd: 734, kind: "代码事实", note: "认证变化只 invalidates 受影响 owner，并通过同一 publication queue 重建；无 owner 时不会重放旧 mutation 立即污染首次 generation。" },
    ],
    trace: [
      { name: "invalidate", input: "config/plugin/auth publication", responsibility: "同步让旧 owner 对新请求不可见，并打开 replacement gate。", output: "stale owners + gate id", anchor: "prepared-model-runtime.ts · L457" },
      { name: "batch build", input: "所有 configured owner inputs", responsibility: "在同一 epoch 构建 plugin registry、auth/model facts 与 catalog。", output: "candidate owner batch", anchor: "prepared-model-runtime.ts · L510" },
      { name: "atomic publish", input: "完整候选与 pending auth mutations", responsibility: "重建 reply-dispatch projection 后清 gate，再广播 published。", output: "committed generation", anchor: "prepared-model-runtime.ts · L588" },
      { name: "run lease", input: "一次 Agent admission", responsibility: "绑定 exact snapshot，阻止运行中热更新换底座。", output: "snapshot + idempotent release", anchor: "prepared-model-runtime.ts · L271" },
      { name: "identity-safe retire", input: "旧 run 完成", responsibility: "只减少旧 owner lease；绝不删除同 key 的替代 owner。", output: "有界 owner retention", anchor: "prepared-model-runtime.ts · L373" },
    ],
  },
  O07: {
    architecture: "工具系统分两阶段。构建阶段合并 core/channel/OpenClaw/plugin/search tools，再依次执行 message-provider、model-provider 与 conversation policy pipeline；每个 named step 都能审计移除了什么。执行阶段 wrapper 先准备参数，ordered before_tool_call chain 执行 loop/voice/trusted policy/approval/plugin hook/final owner approval，再对 Hook 重写后的最终 shape 做 schema validation，之后才越过副作用边界。",
    evidence: [
      { file: "src/agents/agent-tools.ts", symbol: "tool candidate construction", lineStart: 681, lineEnd: 836, kind: "代码事实", note: "plugin-only、ring-zero、tool search、core/channel/OpenClaw tools 由同一 composition root 组装，并携带经过 server session 验证的 caller identity。" },
      { file: "src/agents/agent-tools.ts", symbol: "provider and conversation policy", lineStart: 865, lineEnd: 924, kind: "代码事实", note: "message provider 与 model provider 先过滤，随后 conversation pipeline 应用 capability/profile/agent/group/sender/runtime policy；ring-zero 另带宿主权威检查。" },
      { file: "src/agents/tool-policy-pipeline.ts", symbol: "named policy layers", lineStart: 56, lineEnd: 131, kind: "代码事实", note: "默认层级顺序被写成 profile、provider profile、global、global provider、agent、agent provider、group、sender，诊断能指出是哪一层移除工具。" },
      { file: "src/agents/agent-tools.before-tool-call.policy.ts", symbol: "ordered call policy", lineStart: 90, lineEnd: 176, kind: "代码事实", note: "单次调用先处理 tool-loop admission、voice confirmation、Skill Workshop owner policy 与 trusted policies；源码文件头明确声明顺序本身就是行为。" },
      { file: "src/agents/agent-tools.before-tool-call.policy.ts", symbol: "trusted approval, plugin hook, final approval", lineStart: 248, lineEnd: 398, kind: "代码事实", note: "trusted veto 先于 approval；plugin hook 可 block/requireApproval/rewrite，最终参数仍再走 owner approval；异常统一返回 blocked failure。" },
      { file: "src/agents/agent-tools.before-tool-call.wrapper.ts", symbol: "final execution boundary", lineStart: 402, lineEnd: 494, kind: "代码事实", note: "Hook 完成后才 finalize 参数并 schema validate；steering pause 和最终 voice grant 消费都发生在真正调用实现之前。" },
    ],
    trace: [
      { name: "candidate surface", input: "run context、channel、plugins、sandbox", responsibility: "构造这一轮可能可用的工具全集。", output: "AnyAgentTool[]", anchor: "agent-tools.ts · L681" },
      { name: "surface policy", input: "profile/provider/agent/group/sender policy", responsibility: "逐层过滤模型可见目录并记录 exclusion provenance。", output: "visible tools", anchor: "tool-policy-pipeline.ts · L134" },
      { name: "call policy", input: "模型生成的 tool name 与 raw args", responsibility: "执行 loop detection、可信策略、审批和插件 Hook。", output: "blocked outcome 或 adjusted params", anchor: "before-tool-call.policy.ts · L90" },
      { name: "finalizer", input: "Hook/approval 后参数", responsibility: "工具自有 finalize、schema validate、steering/voice 最终闸门。", output: "validated execution params", anchor: "before-tool-call.wrapper.ts · L448" },
      { name: "implementation", input: "完成最终校验与审批的工具参数", responsibility: "越过副作用边界，记录 outcome、diagnostics 与 terminal presentation。", output: "AgentToolResult", anchor: "before-tool-call.wrapper.ts · L494" },
    ],
  },
  O08: {
    architecture: "插件生命周期先由 gateway startup plan 根据 manifest、配置与需要的 agentRuntime ids 计算激活集合；runtime 执行后，registrar 验证 Harness 的 id、supports 与 runAttempt，并记录唯一 plugin owner。harness registry 实际读取 active plugin registry，selection 对 explicit 与 auto 使用不同语义：显式 plugin runtime 不支持即报错，只有 auto 未命中才回到 built-in OpenClaw。",
    evidence: [
      { file: "src/plugins/gateway-startup-plugin-plan.ts", symbol: "required harness activation", lineStart: 70, lineEnd: 100, kind: "代码事实", note: "Gateway 从原始 config 收集 requiredAgentHarnessRuntimes，并与 manifest registry 一起制定启动计划，未先加载全部插件 runtime。" },
      { file: "src/plugins/gateway-startup-plugin-plan.ts", symbol: "manifest-first startup selection", lineStart: 131, lineEnd: 190, kind: "代码事实", note: "每个 plugin 先用 manifest/channel/config 判断是否需要启动；只有 canStartGatewayStartupPlugin 成立才进入 activation 列表。" },
      { file: "src/plugins/registry-registrars-providers.ts", symbol: "registerAgentHarness", lineStart: 77, lineEnd: 118, kind: "代码事实", note: "注册必须有 id、supports 与 runAttempt；重复 id 报出已有 owner，不允许后一插件静默覆盖。" },
      { file: "src/agents/harness/registry.ts", symbol: "active registry ownership", lineStart: 14, lineEnd: 66, kind: "代码事实", note: "Harness 列表来自 active plugin registry；direct replacement 需通过 owner 检查，查询结果携带 ownerPluginId。" },
      { file: "src/agents/harness/selection.ts", symbol: "explicit versus auto selection", lineStart: 310, lineEnd: 468, kind: "代码事实", note: "显式 plugin runtime 缺失或不支持时抛错，plugin 运行失败也不回落；auto 才按 support priority 选插件并在无匹配时使用 built-in。" },
      { file: "src/plugin-sdk/agent-harness.ts", symbol: "public AgentHarness facade", lineStart: 1, lineEnd: 21, kind: "代码事实", note: "公开 subpath 只暴露低层 runtime 所需类型和少量宿主 helper，并明确要求 model/vendor 协议代码留在注册 Harness 的插件中。" },
    ],
    trace: [
      { name: "manifest control plane", input: "installed index、manifest registry 与 config", responsibility: "无需执行插件代码即可判断哪些 runtime 需要激活。", output: "startup plugin ids", anchor: "gateway-startup-plugin-plan.ts · L70" },
      { name: "plugin registrar", input: "插件调用 registerAgentHarness", responsibility: "验证最低合同并建立唯一 id→owner 关系。", output: "registry registration", anchor: "registry-registrars-providers.ts · L77" },
      { name: "active registry", input: "当前 plugin generation", responsibility: "为选择、reset、dispose 提供同一生命周期视图。", output: "RegisteredAgentHarness[]", anchor: "harness/registry.ts · L14" },
      { name: "selection policy", input: "prepared model route 与 runtime policy", responsibility: "显式路径 fail closed；auto 依据 support/priority 选择。", output: "one AgentHarness", anchor: "selection.ts · L310" },
      { name: "SDK boundary", input: "第三方 Harness 实现", responsibility: "只暴露受支持契约，阻止 vendor 协议侵入 core。", output: "可独立演进的插件 runtime", anchor: "plugin-sdk/agent-harness.ts · L1" },
    ],
  },
  N01: {
    architecture: "MessageBus 本身只是两只无界 asyncio.Queue；InboundMessage.session_key 统一身份信封，AgentLoop.run() 才解释 per-session lock、跨 session task、活跃轮次 pending queue 与 leftover re-publish。ChannelManager 在另一端消费 OutboundMessage，并负责具体渠道的过滤、合并、去重与重试。因此‘消息边界’和‘调度/投递策略’被刻意拆开。",
    evidence: [
      { file: "nanobot/bus/events.py", symbol: "InboundMessage.session_key / OutboundMessage", lineStart: 23, lineEnd: 59, kind: "代码事实", note: "入站信封允许 thread-scoped override，否则稳定使用 channel:chat_id；出站信封把路由 metadata 与内部 event 分开。" },
      { file: "nanobot/bus/queue.py", symbol: "MessageBus", lineStart: 8, lineEnd: 34, kind: "代码事实", note: "实现只有 inbound/outbound Queue 与四个 put/get 方法，没有订阅、ack、优先级或调度逻辑，证明它是刻意保持薄的边界。" },
      { file: "nanobot/agent/loop.py", symbol: "AgentLoop.run", lineStart: 1197, lineEnd: 1264, kind: "代码事实", note: "Loop 对活跃 session 将普通 follow-up 放入 pending queue；否则创建跨 session task，priority command 与普通命令另走直接分发路径。" },
      { file: "nanobot/agent/loop.py", symbol: "AgentLoop._dispatch", lineStart: 1268, lineEnd: 1378, kind: "代码事实", note: "每个 session 经独立 lock 串行，进程级 semaphore 限制跨 session 并发；轮次结束时未消费的注入会重新发布到 bus。" },
    ],
    trace: [
      { name: "Channel adapter", input: "飞书、WebSocket 或终端原生事件", responsibility: "做协议解析和访问控制，产生统一 InboundMessage。", output: "带 channel/chat_id/metadata 的信封", anchor: "events.py · L23" },
      { name: "MessageBus", input: "InboundMessage", responsibility: "只提供异步交接，不判断会话、优先级或并发。", output: "inbound queue 中的下一条消息", anchor: "queue.py · L8" },
      { name: "AgentLoop.run", input: "消息与 effective session key", responsibility: "决定直接命令、注入活跃轮次还是创建新 task。", output: "pending injection 或 dispatch task", anchor: "loop.py · L1197" },
      { name: "_dispatch", input: "一个 session 的待处理消息", responsibility: "持有 session lock，执行 turn，并把剩余注入重新放回总线。", output: "OutboundMessage / 后续 inbound", anchor: "loop.py · L1268" },
    ],
  },
  N02: {
    architecture: "AgentLoop 用 TurnContext 承载产品事务，按 restore→compact→command→build→run→save→respond 执行；AgentRunner 接收 AgentRunSpec，在每次 provider 调用前制作受治理副本，处理 tool call、checkpoint、注入与终止。Loop 的 save stage 在 delivery complete 之前持久化并发布 SessionTurnPersisted，形成可观察的提交边界。",
    evidence: [
      { file: "nanobot/agent/loop.py", symbol: "AgentLoop._process_message", lineStart: 1446, lineEnd: 1564, kind: "代码事实", note: "TurnContext 建立后，源码明确按七个命名 stage 顺序执行；command 命中时才提前返回。" },
      { file: "nanobot/agent/runner.py", symbol: "AgentRunner._run_core", lineStart: 461, lineEnd: 547, kind: "代码事实", note: "每一迭代先生成 model copy、运行 hook、准备 provider state、请求模型；遇到工具调用先追加 assistant tool-call 消息并写 awaiting_tools checkpoint。" },
      { file: "nanobot/agent/runner.py", symbol: "tool completion checkpoint and injection", lineStart: 556, lineEnd: 623, kind: "代码事实", note: "工具结果按调用顺序追加后写 tools_completed checkpoint，再 drain mid-turn injection，最后才开始下一次模型迭代。" },
      { file: "nanobot/agent/loop.py", symbol: "AgentLoop._persist_turn", lineStart: 1903, lineEnd: 1952, kind: "代码事实", note: "save stage 先写新增消息、清 checkpoint 并持久化 session，随后 await SessionTurnPersisted；respond stage 在它之后。" },
    ],
    trace: [
      { name: "TurnContext", input: "InboundMessage、session key 与 delivery", responsibility: "集中保存本轮产品状态，不把渠道状态塞进 Runner。", output: "阶段化 turn 对象", anchor: "loop.py · L1482" },
      { name: "build stage", input: "恢复后的 session 与固定 runtime", responsibility: "压缩预算、取 history、持久化 user 输入并组装 initial_messages。", output: "AgentRunSpec 所需材料", anchor: "loop.py · L1741" },
      { name: "AgentRunner", input: "messages、tools、runtime、hooks 与 callbacks", responsibility: "推进模型—工具迭代并在危险边界发 checkpoint。", output: "AgentRunResult", anchor: "runner.py · L419" },
      { name: "save/respond", input: "完整 run messages 与 final content", responsibility: "先提交 durable session 和 runtime event，再组装渠道回复。", output: "已提交的 OutboundMessage", anchor: "loop.py · L1903" },
    ],
  },
  N03: {
    architecture: "上下文有三道不同边界：Session.get_history 负责从持久消息中选择合法可重放后缀；ContextBuilder 把项目 AGENTS.md、Agent SOUL/USER、工具契约、长期记忆、active skills、recent history 与 compact summary 按顺序组装；ContextGovernor 只修改即将发给模型的 copy，修复 tool 协议、离线大结果并做 inflight compact，保持 session append boundary 不变。",
    evidence: [
      { file: "nanobot/session/manager.py", symbol: "Session.get_history", lineStart: 208, lineEnd: 354, kind: "代码事实", note: "重放先考虑 last_consolidated、消息数和 token 尾预算，再过滤命令、恢复媒体 breadcrumb、对齐 user turn 并去除前置孤儿 tool result。" },
      { file: "nanobot/agent/context.py", symbol: "ContextBuilder.build_system_prompt", lineStart: 68, lineEnd: 127, kind: "代码事实", note: "系统上下文的真实顺序是 identity/bootstrap/tool contract/memory/active skills/skills summary/recent history/archived summary。" },
      { file: "nanobot/agent/context.py", symbol: "ContextBuilder._load_bootstrap_files", lineStart: 169, lineEnd: 196, kind: "代码事实", note: "项目 AGENTS.md 从 effective project root 读取，而 SOUL.md 和 USER.md 始终来自 configured agent workspace，明确区分两类所有者。" },
      { file: "nanobot/agent/context_governance.py", symbol: "ContextGovernor.prepare_for_model", lineStart: 73, lineEnd: 90, kind: "代码事实", note: "模型副本依次清 placeholder、坏 tool call、孤儿/缺失结果、工具结果预算、inflight overflow 和历史 snip；模块注释明确禁止原地改 session history。" },
    ],
    trace: [
      { name: "Session.get_history", input: "完整持久 messages 与 replay budgets", responsibility: "选择以 user/tool 合法边界开头的近期事实。", output: "可重放 history", anchor: "manager.py · L208" },
      { name: "ContextBuilder", input: "项目路径、Agent workspace、history 与本轮输入", responsibility: "按所有权与优先顺序形成 system + conversation messages。", output: "持久语义完整的 messages", anchor: "context.py · L206" },
      { name: "runtime context", input: "工具和应用按本轮计算的额外块", responsibility: "附加可追踪 marker，使注入在合并/重放时可分离。", output: "带内部来源标记的 user content", anchor: "context.py · L267" },
      { name: "ContextGovernor", input: "messages copy 与本轮预算", responsibility: "修复 provider 可接受性并限制发送大小，不移动保存边界。", output: "model_messages", anchor: "context_governance.py · L73" },
    ],
  },
  N04: {
    architecture: "ProviderSpec 是静态元数据真源，factory 先解析并验证 provider/backend，再构造 ProviderSnapshot；ModelRuntimeResolver 把快照变成不可变 LLMRuntime，并通过 invalidate→next admit 延迟应用配置变更。运行中 turn 持有自己的 runtime。ProviderConversationState 则作为带 provider/model/version 的私有 sidecar 保存协议续接信息，不暴露到公共消息历史。",
    evidence: [
      { file: "nanobot/providers/registry.py", symbol: "ProviderSpec", lineStart: 31, lineEnd: 132, kind: "代码事实", note: "provider 名称匹配、backend、gateway/local、模型前缀、reasoning 与 Responses 能力集中在一份不可变 metadata 结构。" },
      { file: "nanobot/providers/factory.py", symbol: "ProviderSnapshot / _resolve_provider_setup", lineStart: 14, lineEnd: 131, kind: "代码事实", note: "快照冻结 provider、model、context window、signature 与 generation；构造前统一验证 API base、key 与 backend 限制。" },
      { file: "nanobot/agent/model_runtime.py", symbol: "ModelRuntimeResolver.admit / invalidate", lineStart: 69, lineEnd: 88, kind: "代码事实", note: "配置变化只设置 refresh flag 并清 preset cache；真正 refresh 发生在下一次 admit，不会原地改写已经交给 Runner 的 runtime。" },
      { file: "nanobot/providers/base.py", symbol: "ProviderConversationState", lineStart: 156, lineEnd: 197, kind: "代码事实", note: "provider 私有 payload 和 pending messages 明确禁止进入普通日志/公共历史，并提供独立 private-record 序列化。" },
    ],
    trace: [
      { name: "ProviderSpec", input: "模型名、API key/base 与显式 provider", responsibility: "决定匹配优先级和具体 backend 能力。", output: "provider setup metadata", anchor: "registry.py · L31" },
      { name: "factory", input: "ModelPreset + Config", responsibility: "验证配置并构造 plain/fallback provider 与一致快照。", output: "ProviderSnapshot", anchor: "factory.py · L14" },
      { name: "ModelRuntimeResolver", input: "快照与 config invalidation", responsibility: "在 turn admission 固化 runtime，管理 preset cache。", output: "本轮不可变 LLMRuntime", anchor: "model_runtime.py · L76" },
      { name: "conversation state", input: "provider response 的续接私有数据", responsibility: "与公开 messages 分离地 checkpoint 和恢复。", output: "session JSONL 私有 state record", anchor: "base.py · L156" },
    ],
  },
  N05: {
    architecture: "ToolLoader 通过包扫描和 nanobot.tools entry points 发现能力；ToolRegistry 维护稳定 schema 排序、精确名称、参数 JSON 解包/类型转换/校验和 ContextVar 请求上下文。Runner 不直接无条件并发：它按 Tool.concurrency_safe 将连续调用切成 batches，只有 batch 内多个安全工具才 gather，副作用或 exclusive 工具单独执行，最终结果保持模型调用顺序。",
    evidence: [
      { file: "nanobot/agent/tools/loader.py", symbol: "ToolLoader.discover / load", lineStart: 36, lineEnd: 124, kind: "代码事实", note: "内置模块按约定扫描，外部插件来自 nanobot.tools entry point；built-in 名称冲突会阻止 plugin 静默覆盖。" },
      { file: "nanobot/agent/tools/base.py", symbol: "Tool.concurrency_safe", lineStart: 189, lineEnd: 228, kind: "代码事实", note: "默认工具是有副作用且不可并发；只有 read_only 且非 exclusive 才自动声明 concurrency_safe。" },
      { file: "nanobot/agent/tools/registry.py", symbol: "ToolRegistry.prepare_call", lineStart: 110, lineEnd: 147, kind: "代码事实", note: "执行前严格按注册名解析，之后才处理 arguments wrapper、cast 与 JSON Schema validation；近似名称只给提示，不用于执行。" },
      { file: "nanobot/agent/runner.py", symbol: "_execute_tools / _partition_tool_batches", lineStart: 1359, lineEnd: 1408, kind: "代码事实", note: "Runner 按分批结果顺序聚合；并发 gather 只用于长度大于一的安全批次，返回列表仍与输入调用顺序一致。" },
      { file: "nanobot/agent/runner.py", symbol: "_partition_tool_batches", lineStart: 1647, lineEnd: 1670, kind: "代码事实", note: "连续 concurrency_safe 调用可合并；任何不安全工具先 flush 当前批次，再作为单元素批次，阻止读写跨越重排。" },
    ],
    trace: [
      { name: "ToolLoader", input: "内置 Python package 与第三方 entry points", responsibility: "按 scope/enabled/create 约定实例化工具并处理冲突。", output: "ToolRegistry entries", anchor: "loader.py · L36" },
      { name: "get_definitions", input: "ToolRegistry 当前注册的全部工具", responsibility: "提供稳定排序的 schema，内置前缀在前、MCP 后缀在后，利于 prompt cache。", output: "provider tools schema", anchor: "registry.py · L86" },
      { name: "prepare_call", input: "模型工具名与 arguments", responsibility: "精确查找、解包、cast、validate，在副作用前产生稳定错误。", output: "Tool + typed params", anchor: "registry.py · L110" },
      { name: "batch executor", input: "保序 ToolCallRequest 列表", responsibility: "按 concurrency_safe 隔离并发区间，收集错误并保序回填。", output: "tool result messages", anchor: "runner.py · L1359" },
    ],
  },
  N06: {
    architecture: "JsonlSessionStore 每次重写 metadata、可选 provider-state record 与全部 messages 到随机 temp，再 os.replace；fsync 模式还刷目录。Consolidator 估算完整下一轮 prompt，在 user-turn 安全边界把旧前缀摘要或 raw archive 到 memory/history.jsonl，只推进 last_consolidated，不删除 Session.messages。Session.get_history 将该游标视为归档进度而非硬 replay 边界，仍保留固定近期合法后缀。",
    evidence: [
      { file: "nanobot/session/manager.py", symbol: "JsonlSessionStore._save_unlocked", lineStart: 1229, lineEnd: 1269, kind: "代码事实", note: "保存写入独占随机临时文件，包含 metadata、private provider state 与所有消息，随后原子 replace；durable shutdown 可同时 fsync 文件和目录。" },
      { file: "nanobot/session/manager.py", symbol: "Session.get_history", lineStart: 221, lineEnd: 261, kind: "代码事实", note: "last_consolidated 被注释明确为 archive progress 而非 replay boundary；代码向前保留近期原始后缀并对齐 user/tool 合法起点。" },
      { file: "nanobot/agent/memory.py", symbol: "Consolidator.maybe_consolidate_by_tokens", lineStart: 1044, lineEnd: 1152, kind: "代码事实", note: "预算超限时最多多轮选择 user-turn boundary；无论摘要成功或 raw fallback 都推进 cursor，避免重复归档同一块，且清除 provider state。" },
      { file: "nanobot/agent/memory.py", symbol: "Consolidator.archive", lineStart: 989, lineEnd: 1042, kind: "代码事实", note: "归档 LLM 出错或返回 error 时调用 raw_archive；成功时把摘要追加到 history.jsonl，而不是覆盖 session transcript。" },
      { file: "nanobot/agent/autocompact.py", symbol: "AutoCompact.prepare_session", lineStart: 108, lineEnd: 138, kind: "代码事实", note: "idle compact 的 summary 既可从内存热路径读取，也可在重启后从 session metadata 冷恢复并注入下一轮。" },
    ],
    trace: [
      { name: "atomic session store", input: "Session object", responsibility: "生成可修复的 JSONL 快照并原子发布。", output: "base64url session file", anchor: "manager.py · L1229" },
      { name: "token estimator", input: "完整 replayable history、system prompt 与 tool schemas", responsibility: "估算真实下一轮输入，而非只数聊天文本。", output: "estimated prompt tokens", anchor: "memory.py · L941" },
      { name: "Consolidator", input: "旧的 unconsolidated prefix", responsibility: "在 user boundary 摘要；失败则 raw archive，并推进 archive cursor。", output: "history.jsonl entry + last_consolidated", anchor: "memory.py · L1044" },
      { name: "replay projection", input: "完整 messages、cursor 与 budgets", responsibility: "保留近期合法原始后缀并附加 archived summary。", output: "下一轮可见上下文", anchor: "manager.py · L208" },
    ],
  },
  N07: {
    architecture: "MemoryStore 的 history.jsonl 是带单调 cursor 的归档流，append 在进程锁内完成 cursor 分配与追加。Dream 从 .dream_cursor 后读取有限批次，把真实 SOUL/USER/MEMORY 内容放进 prompt，并使用只允许 skills 目录和三份记忆文件写入的 ToolRegistry。Gateway 通过 ephemeral process_direct 执行；只有 clean completion 才推进 cursor，真实 Git diff 生成 audit commit，失败批次保留待重试。",
    evidence: [
      { file: "nanobot/agent/memory.py", symbol: "MemoryStore.append_history", lineStart: 280, lineEnd: 331, kind: "代码事实", note: "history entry 先去掉 think 泄漏并限长；cursor 分配与 append 受同一线程锁保护，随后更新持久 cursor counter。" },
      { file: "nanobot/agent/memory.py", symbol: "MemoryStore.build_dream_prompt", lineStart: 582, lineEnd: 630, kind: "代码事实", note: "Dream 只取尚未处理的最多一批 history，并把三份当前 durable memory 文件作为 ground truth 嵌入 prompt。" },
      { file: "nanobot/agent/memory.py", symbol: "MemoryStore.build_dream_tools", lineStart: 642, lineEnd: 683, kind: "代码事实", note: "Dream 工具表仅注册 read/edit/apply_patch/write；写权限限定到 workspace skills 和 SOUL/USER/MEMORY 三个精确文件。" },
      { file: "nanobot/cli/gateway_runtime.py", symbol: "on_cron_job dream path", lineStart: 502, lineEnd: 569, kind: "代码事实", note: "Dream 作为 ephemeral direct run 使用专属 runtime/tools；仅 completed 且无 tool error 推进 cursor，finally 中基于真实 diff commit、compact history 并清理旧 Dream sessions。" },
      { file: "nanobot/cli/gateway_runtime.py", symbol: "_commit_dream_changes", lineStart: 138, lineEnd: 149, kind: "代码事实", note: "没有真实 content diff 就不进入 commit；提交说明由 machine-derived diff 生成，而非模型最后回答。" },
    ],
    trace: [
      { name: "history cursor", input: "consolidation summary 或 raw archive", responsibility: "为每条长期候选分配单调消费位置。", output: "history.jsonl record", anchor: "memory.py · L280" },
      { name: "Dream prompt", input: "cursor 后的批次 + 当前记忆文件", responsibility: "让模型基于真实文件而非旧 mental model 决定编辑。", output: "受限后台任务输入", anchor: "memory.py · L582" },
      { name: "restricted registry", input: "workspace 与精确可写文件", responsibility: "把 Dream 的副作用限制在 memory/profile/skills。", output: "四类文件工具", anchor: "memory.py · L642" },
      { name: "completion gate", input: "stop reason、tool errors 与 worktree diff", responsibility: "决定是否确认消费并记录真实改动。", output: "新 dream cursor + 可选 Git commit", anchor: "gateway_runtime.py · L530" },
    ],
  },
  N08: {
    architecture: "Gateway 创建 Bus、RuntimeEventBus、SessionManager、Cron、LocalTriggerStore、共享 ToolRegistry 与 MCPProvider，再把 registry 注入 AgentLoop、把 sessions/runtime callbacks 注入 ChannelManager。MCPProvider 是 application-owned：Gateway 在 agent.run 前 connect、finally aclose。长期任务通过 gather 并行；ChannelManager 独立消费 outbound，执行 reasoning/progress policy、stream delta coalesce、origin-scoped duplicate suppression 与 retry。",
    evidence: [
      { file: "nanobot/cli/gateway_runtime.py", symbol: "gateway composition", lineStart: 350, lineEnd: 430, kind: "代码事实", note: "同一 composition root 创建 bus/events/session/cron/registry/MCP，并把共享 registry 与 session manager 交给 AgentLoop。" },
      { file: "nanobot/cli/gateway_runtime.py", symbol: "runtime task ownership", lineStart: 857, lineEnd: 901, kind: "代码事实", note: "Gateway 在 Agent 前连接 MCP，并并行启动 watcher、agent、channels、local triggers 与可选 health/browser；MCP 的关闭在 Agent task finally。" },
      { file: "nanobot/channels/manager.py", symbol: "ChannelManager.start_all", lineStart: 577, lineEnd: 595, kind: "代码事实", note: "ChannelManager 自己创建 outbound dispatcher，再为每个 enabled channel 启动长期 task；AgentRunner 不参与渠道生命周期。" },
      { file: "nanobot/channels/manager.py", symbol: "ChannelManager._dispatch_outbound", lineStart: 683, lineEnd: 760, kind: "代码事实", note: "投递层过滤 reasoning/progress/retry 事件，合并 stream delta，按 origin 消重并选择目标 channel 后重试发送。" },
      { file: "nanobot/cli/gateway_runtime.py", symbol: "Dream lifecycle exception", lineStart: 502, lineEnd: 529, kind: "代码事实", note: "Dream 是 Gateway 特判的内部 job，但真正执行仍复用 AgentLoop.process_direct；这是组合层策略而非 Runner 内部分支。" },
    ],
    trace: [
      { name: "construct", input: "Config 与 workspace", responsibility: "建立共享状态和所有权关系，避免 registry/session 各自复制。", output: "AgentLoop + ChannelManager + infrastructure", anchor: "gateway_runtime.py · L350" },
      { name: "connect", input: "MCP config 与共享 registry", responsibility: "在 Agent 消费消息前建立外部工具连接。", output: "已注册 MCP tools", anchor: "gateway_runtime.py · L860" },
      { name: "long-lived gather", input: "watcher/agent/channels/triggers/health tasks", responsibility: "并行运行直到任一关键任务结束或收到 shutdown。", output: "runtime task group", anchor: "gateway_runtime.py · L867" },
      { name: "outbound dispatcher", input: "统一 OutboundMessage events", responsibility: "应用渠道能力策略、流式合并、去重与失败重试后可靠投递。", output: "外部平台消息/流更新", anchor: "manager.py · L683" },
      { name: "shutdown", input: "signal、task failure 或退出", responsibility: "先取消任务，再关闭 Agent/MCP/Channels 并 durable flush sessions。", output: "确定性释放的进程", anchor: "gateway_runtime.py · L923" },
    ],
  },
  D01: {
    architecture: "Registry.plugin() 为每次 ctx.plugin() 调用创建独立 Fiber。Reflect.provide() 不是直接把服务写进全局对象，而是委托当前 Fiber.effect() 安装并返回注销器；Fiber 统一收集 disposer，卸载时逆序执行。插件树、服务所有权和副作用回收因此是同一套机制，而不是三个约定。",
    evidence: [
      { file: "vendor/cordis/src/registry.ts", symbol: "Registry.plugin", lineStart: 316, lineEnd: 336, kind: "代码事实", note: "每次插件挂载都会创建自己的 Fiber，并把 config 与启动栈交给该节点；它不是复用一个全局插件实例。" },
      { file: "vendor/cordis/src/reflect.ts", symbol: "ReflectService.provide", lineStart: 277, lineEnd: 304, kind: "代码事实", note: "provide() 直接落在 this.ctx.fiber.effect() 上，安装服务的同时定义撤销路径，证明服务注册受当前插件所有。" },
      { file: "vendor/cordis/src/fiber.ts", symbol: "Fiber.effect", lineStart: 418, lineEnd: 488, kind: "代码事实", note: "effect 归一化同步、异步与生成器清理器，保证 disposer 幂等，并按栈式顺序完成回收。" },
      { file: "vendor/cordis/src/events.ts", symbol: "Events.register", lineStart: 245, lineEnd: 263, kind: "代码事实", note: "事件监听器同样通过当前 fiber.effect 注册，返回的 disposer 删除精确 callback；监听与服务因此服从同一所有权和逆序清理协议。" },
    ],
    trace: [
      { name: "ctx.plugin()", input: "插件对象、配置和当前 Context", responsibility: "把一次安装请求交给 Registry；同一插件可以在不同 Context 中拥有不同实例。", output: "一次新的插件挂载请求", anchor: "registry.ts · plugin()" },
      { name: "new Fiber()", input: "父 Context、插件与外层调用栈", responsibility: "创建所有权节点并派生插件自己的 Context。", output: "带父子关系的插件 Fiber", anchor: "registry.ts · L316" },
      { name: "ctx.provide()", input: "服务名与 provider 值", responsibility: "检查冲突并把服务安装动作登记到当前 Fiber。", output: "可由依赖方读取的服务", anchor: "reflect.ts · L277" },
      { name: "fiber.effect()", input: "安装函数及其返回的清理函数", responsibility: "把副作用和 disposer 变成一个可等待、只结束一次的生命周期单元。", output: "disposable effect", anchor: "fiber.ts · L418" },
      { name: "reverse dispose", input: "插件 Fiber 上已完成或进行中的 effects", responsibility: "先停止后注册的依赖者，再停止更早的提供者，避免清理顺序反转。", output: "没有残留服务或监听器的已卸载插件", anchor: "fiber.ts · effect cleanup" },
    ],
  },
  D02: {
    architecture: "loadProfile() 先解析 profile template 中有序的 bundle manifest 与各自 cordis.patch.yml，再加入用户层；composeEntries() 对 layers.flat() 只调用一次 applyEntryPatches。boot() 直到最终 entries 就绪才创建 Context 与 Loader，挂载失败则 dispose 半成品 Context。这里最重要的边界是：组合属于启动前的纯配置阶段，插件激活属于之后的生命周期阶段。",
    evidence: [
      { file: "packages/boot/app-boot/src/profile.ts", symbol: "PROFILE_TEMPLATES / loadProfile", lineStart: 114, lineEnd: 126, kind: "代码事实", note: "web 与 headless 都以 base 为第一层，只在第二层选择自己的 surface bundle，产品差异从模板层就已显式。" },
      { file: "packages/boot/app-boot/src/profile.ts", symbol: "loadProfile / composeEntries", lineStart: 371, lineEnd: 420, kind: "代码事实", note: "有序收集 bundle patches 后展平，composeEntries 以一次 applyEntryPatches 合成最终配置，避免逐层启动、逐层修改。" },
      { file: "packages/boot/app-boot/src/index.ts", symbol: "boot", lineStart: 757, lineEnd: 802, kind: "代码事实", note: "最终配置完成后才创建 Context、提供 dshHomePath 并挂载 Loader；异常分支销毁部分启动的上下文。" },
      { file: "packages/boot/app-boot/tests/user-patches.spec.ts", symbol: "id-targeted override and insert", lineStart: 270, lineEnd: 294, kind: "测试证据", note: "真实 boot 测试同时覆盖稳定 id 覆盖、insert 与 !!js 环境插值，并在最终挂载树中断言结果，证明用户层确实进入同一次组合。" },
    ],
    trace: [
      { name: "loadProfile()", input: "profile 名、home patch 与 CLI patch", responsibility: "解析模板并保留每一层的来源与顺序。", output: "尚未启动的 patch layer 列表", anchor: "profile.ts · L371" },
      { name: "bundle manifests", input: "base + web-app 或 base + headless", responsibility: "定位每个 bundle 的 manifest 和 cordis.patch.yml，而不是执行插件。", output: "按模板顺序排列的 bundle layers", anchor: "PROFILE_TEMPLATES · L114" },
      { name: "layers.flat()", input: "bundle 层、用户层与临时覆盖层", responsibility: "形成唯一的 patch 输入序列，保留后来者覆盖前者的含义。", output: "扁平且有序的 entry patches", anchor: "composeEntries · L413" },
      { name: "applyEntryPatches()", input: "空 entries 与完整 patches", responsibility: "一次性计算最终插件条目树及稳定 id 替换结果。", output: "可打印、可审核的 final entries", anchor: "profile.ts · composeEntries" },
      { name: "Loader.mount()", input: "final entries 与新 Context", responsibility: "进入真正的副作用阶段，激活插件并审计依赖。", output: "完整运行时或已回收的失败启动", anchor: "index.ts · boot()" },
    ],
  },
  D03: {
    architecture: "Session.append() 在修改 log 前验证 lossless JSON 与 surface metadata，分配 seq 后深度冻结事件及嵌套数据。deriveMessages() 不遍历一份独立 messages 状态，而是从当前 surface nodes 投影并缓存模型历史；surface replacement 只让节点退出投影。fork() 复制稳定前缀，并拒绝在未闭合 turn 内切分。",
    evidence: [
      { file: "packages/core/session/src/index.ts", symbol: "Session.append", lineStart: 604, lineEnd: 724, kind: "代码事实", note: "校验在 log mutation 之前完成；成功事件以 log.length 获得 seq，事件与数据被冻结，失败不会留下半条记录。" },
      { file: "packages/core/session/src/index.ts", symbol: "Session.deriveMessages", lineStart: 726, lineEnd: 805, kind: "代码事实", note: "模型消息从 surface 投影生成并缓存；replaceGeneration 改变时才重建，说明 messages 是派生视图。" },
      { file: "packages/core/session/src/index.ts", symbol: "Session.fork", lineStart: 1081, lineEnd: 1153, kind: "代码事实", note: "fork 复制稳定事件前缀并检查 turn 边界，防止子会话从一半工具链或一半 turn 开始。" },
      { file: "packages/core/session/tests/fork.spec.ts", symbol: "fork stable prefix tests", lineStart: 79, lineEnd: 135, kind: "测试证据", note: "测试验证子会话得到深度冻结的独立前缀、保留 closed turn 后的 log-only 事件，并能在父会话开放新 turn 时从更早稳定边界分叉。" },
    ],
    trace: [
      { name: "validate event", input: "待追加 SessionEvent 与 surface metadata", responsibility: "验证 JSON 可无损持久化、事件形状和 surface 操作合法性；此时尚未修改日志。", output: "可提交事件或明确异常", anchor: "Session.append · L604" },
      { name: "append + freeze", input: "通过校验的事件", responsibility: "分配单调 seq、深度冻结后追加，让后续消费者不能偷偷改写旧事实。", output: "不可变 durable event", anchor: "Session.append" },
      { name: "surface nodes", input: "全部 durable events 及 surfaceOp", responsibility: "维护哪些消息节点在当前模型表面可见；replace 只改变投影成员。", output: "有序可见节点集合", anchor: "replaceGeneration" },
      { name: "deriveMessages()", input: "当前 surface nodes", responsibility: "把事件语义转换成 provider 可接受的 Message[]，并按 generation 缓存。", output: "本轮模型上下文", anchor: "deriveMessages · L726" },
      { name: "fork()", input: "源 Session 与稳定 boundary", responsibility: "复制可恢复前缀并验证边界没有落入开放 turn。", output: "拥有独立后续日志的子 Session", anchor: "fork · L1081" },
    ],
  },
  D04: {
    architecture: "ReactLoopAgent 把 inbox 的投递模式拆成两个维度：消息在哪个边界被 claim，以及是否唤醒 driver。driver 通过 while (await turn()) 持续处理；turn() 总是记录 turn/start，claim 输入并运行一个或多个 step，最后经过 agent/turn-stopping 才记录 turn/end。step() 从 Session 派生 messages、流式请求模型、追加 assistant 事件并执行工具调用。",
    evidence: [
      { file: "packages/core/agent-loop/src/agent.ts", symbol: "wakeDriver / inbox delivery", lineStart: 99, lineEnd: 181, kind: "代码事实", note: "follow-up、steer、inject 最终通过不同 wakeup 参数进入 inbox；wakeDriver 还处理 abort 后再唤醒，避免并发 driver。" },
      { file: "packages/core/agent-loop/src/agent.ts", symbol: "ReactLoopAgent.turn", lineStart: 246, lineEnd: 331, kind: "代码事实", note: "turn/start、输入 claim、preStep、step 边界和 turn-stopping 的顺序都在这里固定，插件看到的是已落日志的生命周期。" },
      { file: "packages/core/agent-loop/src/agent.ts", symbol: "ReactLoopAgent.step", lineStart: 332, lineEnd: 447, kind: "代码事实", note: "每个 step 从 session 重新派生请求，流式记录响应，再把 tool calls 交给独立 scheduler；返回值决定继续、完成或暂停。" },
      { file: "packages/core/agent-loop/src/index.ts", symbol: "AgentLoop.prepare", lineStart: 459, lineEnd: 555, kind: "代码事实", note: "工厂层融合取消信号、挂接 registry，并按反向顺序安排 cancel、idle、scope dispose 和 detach，补全 driver 外部所有权。" },
    ],
    trace: [
      { name: "inbox delivery", input: "运行期间到达的 follow-up、steer 或 inject", responsibility: "编码消息的目标边界和唤醒语义，而不是只塞进一个数组。", output: "带交付模式的 pending input", anchor: "agent.ts · delivery methods" },
      { name: "wakeDriver()", input: "待处理输入与当前 driver/abort 状态", responsibility: "确保同一 Agent 只有一个 driver，并在必要时等 abort 后再启动。", output: "正在推进的 driver promise", anchor: "wakeDriver · L172" },
      { name: "turn()", input: "下一 turn 可 claim 的 inbox 内容", responsibility: "追加 turn/start，组织 step，并给 stopping 插件最后一次续跑机会。", output: "是否仍欠下一 turn 的布尔值", anchor: "turn · L246" },
      { name: "step()", input: "PromptAssembly 与当前 Session surface", responsibility: "构造请求、消费 LLM stream、持久化 assistant 输出并调度工具。", output: "StepEndReason 或继续信号", anchor: "step · L332" },
      { name: "turn-stopping", input: "当前 step 已不再直接产生工作", responsibility: "允许目标、维护或其他插件在真正关闭 turn 前补充统一输入。", output: "turn/end 或新的待处理工作", anchor: "agent/turn-stopping" },
    ],
  },
  D05: {
    architecture: "executeToolCalls() 先按模型顺序准备调用，再把可并行调用放入有界 rolling pool；exclusive 调用形成前后 barrier。只有 dispatch/body 阶段允许重叠，pre-policy、guards、post-result 与最终 Session 写回仍按模型顺序进行。调度器失败时停止新 dispatch，等待已开始调用 settle，并为未开始调用生成可审计的 aborted result。",
    evidence: [
      { file: "packages/core/agent-loop/src/tool-calls.ts", symbol: "executeToolCalls", lineStart: 59, lineEnd: 117, kind: "代码事实", note: "外层按原始 call list 建立 execution plan；parallel 与 exclusive 的边界在调度前计算，而不是交给工具自己猜。" },
      { file: "packages/core/agent-loop/src/tool-calls.ts", symbol: "dispatch rolling pool / ordered finalize", lineStart: 118, lineEnd: 229, kind: "代码事实", note: "dispatch promise 可以并发 settle，但 finalize 逐 slot 消费；失败会 drain 已启动任务，不会让后台副作用逃离 step 边界。" },
      { file: "packages/core/tools/src/index.ts", symbol: "ToolRuntime.prepareExecution", lineStart: 1463, lineEnd: 1531, kind: "代码事实", note: "参数物化后依次经过 pre-execute、approval 与单调 guards，只有 allow 才产出 dispatch；deny/abort 也被归一化成结果。" },
      { file: "packages/core/tools/src/index.ts", symbol: "dispatchScheduledExecution / finalizeScheduledExecution", lineStart: 1569, lineEnd: 1668, kind: "代码事实", note: "around-dispatch/body 和 post/finalize 是两个明确阶段，既支持 timeout/retry wrapper，也保留统一结果归一化与通知。" },
    ],
    trace: [
      { name: "model-ordered calls", input: "assistant message 中按位置排列的 tool_use", responsibility: "保留模型语义顺序，并读取每个工具的 executionMode。", output: "带 parallel/exclusive 边界的 slots", anchor: "executeToolCalls · L59" },
      { name: "prepareExecution()", input: "工具名、原始参数、agent 与 signal", responsibility: "解析参数、选择 scoped definition、运行审批与 guards；尚未进入 handler。", output: "dispatch、post-result 或 final-result", anchor: "tools/index.ts · L1463" },
      { name: "bounded dispatch", input: "允许执行且可并行的 slots", responsibility: "在并发上限内启动 handler；exclusive slot 等前批完成并阻止后批越过。", output: "按完成时间 settle 的 promises", anchor: "tool-calls.ts · rolling pool" },
      { name: "ordered finalize", input: "每个 slot 已 settle 的 dispatch result", responsibility: "仍按模型原顺序运行 post-execute、内容 finalizer 与结果通知。", output: "规范化 ToolExecutionResult", anchor: "finalizeScheduledExecution" },
      { name: "tool/result events", input: "规范化结果或合成 aborted result", responsibility: "在 step 内按原顺序追加 Session，使下一次模型请求与回放一致。", output: "可追溯的工具结果序列", anchor: "tool-calls.ts · commit" },
    ],
  },
  D06: {
    architecture: "createScope() 用 Cordis Fiber 派生 scoped Context，并在 Context 上写入不透明 ScopeKey。ScopedLayers.chainLayers() 从最远祖先遍历到 exact scope；读取方先继承默认层，再让局部同名条目 shadow。ScopedLayers.effect() 又使用同一个 ctx.effect() 持有注册清理。因此“看见谁”和“谁销毁谁”都由相同父链决定。",
    evidence: [
      { file: "packages/core/scope/src/index.ts", symbol: "createScope", lineStart: 137, lineEnd: 158, kind: "代码事实", note: "创建 scope 时同时建立 Cordis 子 Fiber、写入 scope key 并保留 parent 关系；scope 不是任意字符串命名空间。" },
      { file: "packages/core/scope/src/store.ts", symbol: "ScopedLayers.chainLayers", lineStart: 159, lineEnd: 223, kind: "代码事实", note: "ancestor chain 先反转成 farthest-to-nearest，读取者可以先累积继承项，再让更具体层覆盖。" },
      { file: "packages/core/scope/src/store.ts", symbol: "ScopedLayers.effect", lineStart: 226, lineEnd: 258, kind: "代码事实", note: "scoped 注册通过 ctx.effect 写入 exact layer 并返回原始 disposer，作用域消失时不会遗留局部条目。" },
      { file: "packages/core/tools/src/index.ts", symbol: "ToolRuntime.view", lineStart: 1152, lineEnd: 1204, kind: "代码事实", note: "工具视图把继承 definitions、restrictions 与 own-layer shadowing 合成同一张可见表，展示 Scope 抽象如何被真实子系统消费。" },
    ],
    trace: [
      { name: "createScope()", input: "父 Context、不透明 ScopeKey 与可选父 scope", responsibility: "创建 Cordis 子 Fiber，并建立运行时可查询的 scope 身份。", output: "拥有自己 Context 的 Scope", anchor: "scope/index.ts · L137" },
      { name: "parent chain", input: "当前 scope key", responsibility: "沿父引用收集祖先；没有 scope 时回到 root layer。", output: "从当前节点到根的身份链", anchor: "ScopedLayers.parent" },
      { name: "chainLayers()", input: "当前 scope 到根 scope 的父子身份链", responsibility: "反转为祖先优先顺序，使局部层可以在最后确定性覆盖。", output: "farthest → exact 的 layer 序列", anchor: "store.ts · L192" },
      { name: "local shadow", input: "继承可见表与当前层同名 definition/restriction", responsibility: "仅在当前 scope 子树替换默认能力，不改动全局注册。", output: "agent 专属 ToolView", anchor: "ToolRuntime.view · L1152" },
      { name: "scope dispose", input: "scope Fiber 上的所有 scoped effects", responsibility: "撤销局部注册并让后续查询自然回落到继承实现。", output: "恢复父层视图的子树", anchor: "ScopedLayers.effect · L226" },
    ],
  },
  D07: {
    architecture: "compaction-basic 在 agent/pre-step 检查压力，并在 agent/request-error 处理真正溢出；两条入口最终都调用 compactSurfaceRegion()。该函数锁定平衡且稳定的 surface 区间，记录 compaction/start 后生成摘要，提交前重新验证 region，随后追加 summary 和带 surfaceOp: replace 的 user/message，最后记录 compaction/end。durable log 中被遮蔽事件仍然存在。",
    evidence: [
      { file: "packages/compaction/compaction-basic/src/index.ts", symbol: "agent/pre-step / agent/request-error hooks", lineStart: 147, lineEnd: 205, kind: "代码事实", note: "正常压力治理和溢出恢复是两个事件入口；压缩保持插件身份，没有侵入 ReactLoopAgent.step()。" },
      { file: "packages/compaction/compaction-basic/src/region.ts", symbol: "compactSurfaceRegion", lineStart: 152, lineEnd: 230, kind: "代码事实", note: "函数先验证候选区间、追加 start、调用 summarizer，并把真正提交收束到单独的 commit body。" },
      { file: "packages/compaction/compaction-basic/src/region.ts", symbol: "commitCompactionBody", lineStart: 427, lineEnd: 535, kind: "代码事实", note: "提交前重验 surface 稳定性与摘要收益，再用 replace 事件切换可见表面；任何校验失败都不会改写旧事件。" },
      { file: "packages/compaction/compaction-basic/tests/compaction-basic.spec.ts", symbol: "summarizer failure preserves surface", lineStart: 996, lineEnd: 1010, kind: "测试证据", note: "失败测试明确比较压缩前后的 surface 完全相等，同时要求 durable compaction/end 记录错误，证明失败留下审计事实但不提交可见替换。" },
    ],
    trace: [
      { name: "select region", input: "当前 surface、token 压力与保留策略", responsibility: "只选择平衡且稳定的前缀；工具调用与结果必须成对留在同一区间。", output: "带 start/end 与源 seq 的候选 region", anchor: "compactSurfaceRegion · validation" },
      { name: "compaction/start", input: "候选 region 元数据", responsibility: "在调用摘要模型前先留下尝试事实，便于失败诊断和回放。", output: "durable start event", anchor: "region.ts · L152" },
      { name: "summarize", input: "从 region 派生的模型消息", responsibility: "生成更短摘要；此阶段不得改变原 surface。", output: "候选 summary 与 token 统计", anchor: "summarizer call" },
      { name: "recheck stability", input: "开始时 region 与当前 Session surface", responsibility: "确认并发追加或替换没有让提交依据过期，并验证摘要确实更小。", output: "可提交或安全放弃", anchor: "commitCompactionBody · L427" },
      { name: "surfaceOp replace", input: "summary、start/end 与 source seqs", responsibility: "追加新的 user/message 作为摘要节点，并让旧区间退出模型表面。", output: "新 generation 的可见 surface", anchor: "surfaceOp: replace" },
      { name: "compaction/end", input: "完成的替换元数据", responsibility: "关闭事务事件链；原始 events 仍在 durable log 中可审计。", output: "可继续下一 step 的 Session", anchor: "compaction/end" },
    ],
  },
  D08: {
    architecture: "PROFILE_TEMPLATES 把 web 定义为 base + web-app，把 headless 定义为 base + headless。web-app patch 只在 base 之上增加 Host、客户端和 UI 相关插件；headless patch 不挂 Host/HTTP/browser，只安装 code runtime、headless startup 与 runner。startup.apply() 把一次性 task 作为普通 Cordis service 暴露，再由 runner 消费它。因此两种产品共享 base 内核，差异被限制在最外层组合。",
    evidence: [
      { file: "packages/boot/app-boot/src/profile.ts", symbol: "PROFILE_TEMPLATES", lineStart: 114, lineEnd: 126, kind: "代码事实", note: "两个模板都继承同一个 base，表面 bundle 是唯一分叉点，直接反证“两套 Agent 内核”的理解。" },
      { file: "packages/bundle/web-app/cordis.patch.yml", symbol: "web-app composition patch", lineStart: 1, lineEnd: 120, kind: "代码事实", note: "Web 层装入 Host、server/client 与 UI 功能；这些条目是 base 之后的附加层，并未重新定义 Session 或 AgentLoop。" },
      { file: "packages/bundle/headless/cordis.patch.yml", symbol: "headless composition patch", lineStart: 1, lineEnd: 36, kind: "代码事实", note: "Headless 只保留 code runtime、startup 与 runner 相关条目，没有浏览器服务和 HTTP 宿主。" },
      { file: "packages/bundle/headless/src/startup.ts", symbol: "apply", lineStart: 49, lineEnd: 57, kind: "代码事实", note: "启动插件把 task/options 提供为普通 Cordis service，runner 通过依赖消费；一次性入口没有绕开插件生命周期。" },
    ],
    trace: [
      { name: "profile template", input: "web 或 headless 名称", responsibility: "选择共同 base 与唯一 surface bundle，不选择另一套执行内核。", output: "有序 bundle 名单", anchor: "PROFILE_TEMPLATES · L114" },
      { name: "base bundle", input: "共同的核心 patch", responsibility: "提供 session、LLM、tools、scope 与 agent-loop 等运行时能力。", output: "与界面无关的共享 Harness", anchor: "packages/bundle/base" },
      { name: "surface patch", input: "web-app 或 headless patch", responsibility: "只追加当前产品需要的宿主、入口和展示服务。", output: "产品专属外围服务", anchor: "cordis.patch.yml" },
      { name: "task / UI input", input: "CLI 一次性任务或浏览器交互", responsibility: "把外部输入翻译成共享 Agent service 可消费的请求。", output: "标准 Agent 启动参数", anchor: "headless startup.apply" },
      { name: "shared AgentLoop", input: "已组装 scope、session、tools 与 LLM", responsibility: "以相同 turn/step 协议执行，不关心输入来自哪种 surface。", output: "Session events 与最终结果", anchor: "@deepseek-ai/dsh-agent-loop" },
    ],
  },
  P01: {
    architecture: "当前发布包把经典 Agent、agentLoop 与新 AgentHarness 同时从 pi-agent-core 导出，但 coding-agent 的 sdk.ts 明确构造的是 Agent，随后包进 AgentSession。AgentHarness.create() 目前只允许空记录 Session；prompt、steer、resume、watch 等主路径统一走 unavailable() 并抛 HarnessNotImplemented。因此源码事实是“一条稳定产品路径 + 一条公开施工中的 vNext”，而不是两个等价运行时。",
    evidence: [
      { file: "packages/agent/src/index.ts", symbol: "public exports", lineStart: 43, lineEnd: 80, kind: "代码事实", note: "同一公开入口同时 export Agent/agentLoop 与 harness/agent-harness、session、compaction，说明仓库正在并行暴露两代抽象。" },
      { file: "packages/coding-agent/src/core/sdk.ts", symbol: "createAgentSession construction", lineStart: 256, lineEnd: 380, kind: "代码事实", note: "实际 Coding Agent 创建 new Agent，注入 convertToLlm、streamFn 与 transformContext，再构造 AgentSession；没有调用 AgentHarness。" },
      { file: "packages/agent/src/harness/agent-harness.ts", symbol: "AgentHarness.create / unavailable", lineStart: 347, lineEnd: 420, kind: "代码事实", note: "restore 遇到已有 record 会拒绝；prompt、skill、compact、resume、steer、followUp、drive 等核心方法仍明确返回 HarnessNotImplemented。" },
      { file: "packages/agent/src/harness/session/jsonl/storage.ts", symbol: "JsonlSessionStorage", lineStart: 23, lineEnd: 120, kind: "代码事实", note: "vNext 并非空目录：持久层已有原子 fork、torn-tail 修复和 mutation 重放；完成的是地基，而非完整 orchestration。" },
    ],
    trace: [
      { name: "pi-ai", input: "模型目录、认证与 provider stream", responsibility: "向两代 runtime 提供相同 Message 和 AssistantMessageEvent 基础协议。", output: "Models / Provider 能力", anchor: "packages/ai" },
      { name: "Agent class", input: "model、tools、streamFn 与应用消息", responsibility: "运行当前稳定内存态循环、队列和 awaited listeners。", output: "AgentEvent 与内存 transcript", anchor: "sdk.ts · new Agent" },
      { name: "AgentSession", input: "Agent、SessionManager、ResourceLoader 与 Settings", responsibility: "把通用循环提交成可持久化、可扩展的 Coding Agent 产品。", output: "CLI/RPC/TUI 可操控会话", anchor: "sdk.ts · new AgentSession" },
      { name: "product surfaces", input: "AgentSession API 与事件", responsibility: "提供交互终端、print、RPC 与嵌入 SDK，不复制循环。", output: "用户可见产品行为", anchor: "packages/coding-agent/src/modes" },
      { name: "AgentHarness vNext", input: "durable Session、Models 与 resources", responsibility: "公开目标契约与已完成的持久层；当前不承担产品 prompt 主路径。", output: "部分可用配置 API或 HarnessNotImplemented", anchor: "agent-harness.ts · L347" },
    ],
  },
  P02: {
    architecture: "pi-ai 的根 index.ts 刻意只导出类型、Models 与 side-effect-free utilities；provider factory 位于 providers/*，具体 API 可通过 lazyApi() 在第一次 stream 时动态 import。Provider 同时拥有 catalog、auth 与 stream；ModelsImpl 负责注册、代际化 refresh、认证解析和委托。无论 setup 还是网络阶段失败，最终都必须结束为 AssistantMessageEvent.error 与带 error stopReason 的 AssistantMessage。",
    evidence: [
      { file: "packages/ai/src/index.ts", symbol: "side-effect-free public core", lineStart: 1, lineEnd: 45, kind: "代码事实", note: "文件注释明确根入口不注册 generated catalogs、provider factories 或 OAuth；使用者按需导入具体 provider。" },
      { file: "packages/ai/src/models.ts", symbol: "Provider / Models contracts", lineStart: 110, lineEnd: 210, kind: "代码事实", note: "Provider 契约同时定义 getModels、refresh、filterModels、stream 与 deferred；Models 只做集合、认证与委托。" },
      { file: "packages/ai/src/api/lazy.ts", symbol: "lazyStream / lazyApi", lineStart: 31, lineEnd: 98, kind: "代码事实", note: "异步认证和模块加载被包在同步返回的事件流后面；setup throw 会被翻译成 error event，而不是让调用栈无协议地 reject。" },
      { file: "packages/ai/src/types.ts", symbol: "AssistantMessageEvent", lineStart: 515, lineEnd: 539, kind: "代码事实", note: "协议要求 start 开头，以 done 或 error 终止，并分别表达 text、thinking 和 toolcall 的 start/delta/end。" },
    ],
    trace: [
      { name: "Models.getModel()", input: "provider id 与 model id", responsibility: "在 provider 自己的同步 catalog 中查找模型，不读取 UI 配置。", output: "带 api/provider/cost/capability 的 Model", anchor: "models.ts · L294" },
      { name: "Provider auth", input: "模型、凭据存储、环境和请求 overrides", responsibility: "由对应 Provider 解析有效 credential 与 headers，动态 token 可在每次请求刷新。", output: "可用 auth 或协议化错误", anchor: "Models.getAuth" },
      { name: "lazyApi()", input: "目标 API adapter 的动态 import", responsibility: "首个 stream 时加载实现，并把 setup failure 填入外层流。", output: "AssistantMessageEventStream", anchor: "lazy.ts · L46" },
      { name: "provider stream", input: "Model、Context 与 request options", responsibility: "处理厂商 payload、SSE/WebSocket 与原始增量转换。", output: "统一的 partial events", anchor: "Provider.streamSimple" },
      { name: "terminal event", input: "完成或失败的 provider response", responsibility: "用 done/message 或 error/error-message 关闭流，保证 Agent 不需要 catch 厂商异常。", output: "最终 AssistantMessage", anchor: "types.ts · L523" },
    ],
  },
  P03: {
    architecture: "runLoop() 的内层条件是“还有工具结果要回填，或有 steering 待注入”，每个循环先完整完成一次 assistant stream 与整个工具批次，再在 turn_end、prepareNextTurn 和 shouldStopAfterTurn 之后 drain steering。只有内层自然结束，外层才检查 follow-up；无消息才 emit agent_end。Agent.processEvents() 先归约状态，再按订阅顺序 await listeners，所以 message_end listener 可以成为工具 preflight 前的真实 barrier。",
    evidence: [
      { file: "packages/agent/src/agent-loop.ts", symbol: "runLoop", lineStart: 155, lineEnd: 275, kind: "代码事实", note: "源码直接展示两层 while：steering 在每个完整 turn 后 drain，follow-up 只在没有工具和 steering 时检查。" },
      { file: "packages/agent/src/agent-loop.ts", symbol: "streamAssistantResponse", lineStart: 281, lineEnd: 371, kind: "代码事实", note: "partial AssistantMessage 暂时占据 context 尾部，delta 替换它，done/error 再落最终消息并发出 message_end。" },
      { file: "packages/agent/src/agent.ts", symbol: "PendingMessageQueue", lineStart: 125, lineEnd: 159, kind: "代码事实", note: "all 与 one-at-a-time 只改变每个 drain 点拿几条，不改变 steering/follow-up 各自的控制边界。" },
      { file: "packages/agent/src/agent.ts", symbol: "Agent.processEvents", lineStart: 537, lineEnd: 591, kind: "代码事实", note: "先更新 streamingMessage/messages/pendingToolCalls，再顺序 await 所有 listener；agent_end 发出后仍不代表已经 idle。" },
    ],
    trace: [
      { name: "initial steering", input: "prompt 前或等待期间排入的 steering", responsibility: "在第一次 provider request 前作为 pending input 进入内层循环。", output: "本轮先注入的 AgentMessage[]", anchor: "runLoop · L166" },
      { name: "assistant stream", input: "transform 后的 context、model 与 tools", responsibility: "维护 partial message 并把稳定 lifecycle event 交给 Agent state/listeners。", output: "最终 AssistantMessage", anchor: "streamAssistantResponse · L281" },
      { name: "tool batch", input: "assistant content 中所有 toolCall", responsibility: "完成整批预检、执行与 result artifacts；steering 不会跳过这批工具。", output: "ToolResultMessage[] 与 terminate", anchor: "runLoop · L202" },
      { name: "steering drain", input: "当前 turn 期间排入的 steering queue", responsibility: "在 turn_end 与 stop hook 后取消息，决定内层是否再请求模型。", output: "下一 turn 的 pending inputs", anchor: "runLoop · L259" },
      { name: "follow-up drain", input: "Agent 原本已无工具也无 steering", responsibility: "只在自然停止点拉取后续任务；有消息则重新进入内层。", output: "新 turn 或 agent_end", anchor: "runLoop · L262" },
    ],
  },
  P04: {
    architecture: "AgentMessage 通过 declaration merging 允许 coding-agent 增加 bashExecution、custom、branchSummary 与 compactionSummary。每次请求前，runLoop 先调用 transformContext 让扩展在应用消息层裁剪或注入，再调用 convertToLlm 做协议投影。coding-agent 的 converter 把四种自定义角色分别过滤或映射成 user message，同时原始对象仍可留在 SessionManager 与 UI。",
    evidence: [
      { file: "packages/agent/src/types.ts", symbol: "AgentMessage / AgentLoopConfig", lineStart: 149, lineEnd: 200, kind: "代码事实", note: "契约明确 transformContext 处理 AgentMessage，convertToLlm 再生成 Message，并要求失败时返回安全 fallback 而非抛错。" },
      { file: "packages/agent/src/agent-loop.ts", symbol: "streamAssistantResponse projection boundary", lineStart: 281, lineEnd: 312, kind: "代码事实", note: "两次转换的固定顺序就在 provider request 前；存储状态没有被替换，只构造本次 llmContext。" },
      { file: "packages/coding-agent/src/core/messages.ts", symbol: "CustomAgentMessages declaration", lineStart: 26, lineEnd: 77, kind: "代码事实", note: "coding-agent 扩展了四类产品消息，类型上仍可由通用 Agent 携带。" },
      { file: "packages/coding-agent/src/core/messages.ts", symbol: "convertToLlm", lineStart: 140, lineEnd: 195, kind: "代码事实", note: "bash 可按 excludeFromContext 过滤，custom 与两类 summary 映射成 user message，标准三角色原样通过。" },
    ],
    trace: [
      { name: "persisted messages", input: "SessionManager 当前分支恢复出的 AgentMessage[]", responsibility: "保留展示、扩展状态和模型上下文所需的丰富角色。", output: "应用级 transcript", anchor: "CustomAgentMessages" },
      { name: "transformContext()", input: "完整应用消息与 abort signal", responsibility: "扩展可裁剪、重排或注入本轮上下文，但不改变持久化原件。", output: "本轮选中的 AgentMessage[]", anchor: "agent-loop.ts · L288" },
      { name: "convertToLlm()", input: "选中的应用消息", responsibility: "穷尽每个自定义角色并映射或过滤，只留下 provider 理解的三类 Message。", output: "Message[]", anchor: "messages.ts · L148" },
      { name: "llmContext", input: "Message[]、systemPrompt 与 tool schemas", responsibility: "形成只属于本次请求的窄协议对象。", output: "Provider Context", anchor: "agent-loop.ts · L297" },
      { name: "original transcript", input: "同一轮新增的丰富消息", responsibility: "继续交给 SessionManager 与 TUI，不因 provider 投影而丢失产品语义。", output: "可恢复、可展示历史", anchor: "AgentSession message_end" },
    ],
  },
  P05: {
    architecture: "executeToolCalls() 先扫描整批调用：全局 mode 为 sequential 或任一目标工具声明 sequential，整个 batch 走串行路径。并行路径仍按模型顺序 emit start 并 await prepareToolCall（查找、参数预处理、schema 校验、before hook）；只有 prepared execute/finalize closure 被 Promise.all 并发。tool_execution_end 以实际完成顺序发出，ToolResultMessage 则在 Promise.all 结果数组中恢复为 assistant source order。terminate 只有整批所有 finalized result 都为 true 才生效。",
    evidence: [
      { file: "packages/agent/src/agent-loop.ts", symbol: "executeToolCalls batch mode", lineStart: 408, lineEnd: 431, kind: "代码事实", note: "some(executionMode === sequential) 直接选择整批串行分支；当前实现没有把串行工具当作局部 barrier。" },
      { file: "packages/agent/src/agent-loop.ts", symbol: "executeToolCallsParallel", lineStart: 489, lineEnd: 554, kind: "代码事实", note: "preflight 在 for 循环中逐个 await，prepared closure 最后由 Promise.all 执行；result message 第二次循环按数组顺序发出。" },
      { file: "packages/agent/src/agent-loop.ts", symbol: "prepareToolCall", lineStart: 600, lineEnd: 668, kind: "代码事实", note: "未知工具、参数校验、before block 和 abort 都归一化成 immediate error result，不会漏掉对应 tool result。" },
      { file: "packages/agent/src/agent-loop.ts", symbol: "finalizeExecutedToolCall / termination", lineStart: 582, lineEnd: 584, kind: "代码事实", note: "提前终止使用 every() 而不是 any()；混合批次中一个普通结果就会保持下一轮模型调用。" },
    ],
    trace: [
      { name: "batch mode scan", input: "assistant 的 toolCalls 与可见工具表", responsibility: "检测全局 sequential 或任一工具的 sequential 声明，选择整批策略。", output: "sequential 或 parallel batch", anchor: "agent-loop.ts · L418" },
      { name: "ordered preflight", input: "每个原始 toolCall", responsibility: "按源顺序发 start、准备参数、schema 校验并运行 beforeToolCall。", output: "prepared closure 或 immediate error", anchor: "prepareToolCall · L600" },
      { name: "execute", input: "所有 prepared closures", responsibility: "串行逐个 await，或并行 Promise.all；partial updates 可在执行中发出。", output: "completion-order end events", anchor: "executePreparedToolCall" },
      { name: "after hook", input: "执行结果、validated args 与 error flag", responsibility: "允许替换 content/details/usage/isError/terminate；字段级覆盖，不做深合并。", output: "finalized outcome", anchor: "finalizeExecutedToolCall · L713" },
      { name: "ordered artifacts", input: "Promise.all 保序结果", responsibility: "按模型原 toolCall 顺序创建并 emit ToolResultMessage。", output: "可安全回填 provider 的结果序列", anchor: "agent-loop.ts · L540" },
    ],
  },
  P06: {
    architecture: "AgentSession 构造时订阅 Agent，并安装 tool hooks 与 prepareNextTurn refresh。Agent 在 processEvents() 中先更新自身状态，再 await AgentSession 的 _handleAgentEvent；Session handler 又先 await extension lifecycle，再通知 UI，最后在 message_end 把消息追加到 SessionManager，并更新 retry/compaction 状态。Agent.waitForIdle 只有 agent_end listener 全部 settle、finishRun 清理 activeRun 后才完成。因此持久化与扩展是运行协议中的提交屏障，不是旁路日志。",
    evidence: [
      { file: "packages/coding-agent/src/core/agent-session.ts", symbol: "AgentSession constructor", lineStart: 305, lineEnd: 403, kind: "代码事实", note: "类明确拥有 SessionManager、ResourceLoader、扩展 runner、队列 UI 镜像、重试和压缩状态，并把单个 event handler 订阅到 Agent。" },
      { file: "packages/coding-agent/src/core/agent-session.ts", symbol: "_installAgentToolHooks", lineStart: 471, lineEnd: 555, kind: "代码事实", note: "before/after hooks 在运行时读取最新 extension runner，reload 后无需重装 Agent hook；next turn 又刷新 system/tools/model snapshot。" },
      { file: "packages/coding-agent/src/core/agent-session.ts", symbol: "_handleAgentEvent", lineStart: 609, lineEnd: 681, kind: "代码事实", note: "处理器先清 UI 队列、await 扩展、通知 listeners，再在 message_end 追加 SessionManager；顺序由 awaited Agent listener 保证。" },
      { file: "packages/agent/src/agent.ts", symbol: "runWithLifecycle / processEvents", lineStart: 486, lineEnd: 591, kind: "代码事实", note: "activeRun 在 executor 与全部 event listener 完成后才 finish；agent_end 是最后事件，但 idle 是更晚的 settled 状态。" },
    ],
    trace: [
      { name: "AgentEvent", input: "loop 发出的 message/tool/turn/agent 生命周期事件", responsibility: "作为内核到产品层唯一有序事实通道。", output: "待归约事件", anchor: "Agent.processEvents" },
      { name: "Agent state", input: "当前 MutableAgentState 与事件", responsibility: "先更新 streaming message、messages 或 pending tool ids，listener 总能读到新状态。", output: "已归约内存态", anchor: "agent.ts · L544" },
      { name: "extension barrier", input: "已归约事件与当前 AgentSession", responsibility: "await 扩展 lifecycle/tool hooks，允许扩展先完成自身一致性工作。", output: "扩展已 settle 的事件", anchor: "_emitExtensionEvent" },
      { name: "SessionManager.append", input: "message_end 的最终 message", responsibility: "按消息种类追加普通或 custom entry；非模型产品事件由各自路径持久化。", output: "推进 leaf 的 JSONL entry", anchor: "agent-session.ts · L639" },
      { name: "agent settled", input: "agent_end listeners、retry/compact 决策均完成", responsibility: "清 active run，唤醒 waitForIdle 与产品层后续操作。", output: "真正 idle 的会话", anchor: "_emitAgentSettled / finishRun" },
    ],
  },
  P07: {
    architecture: "SessionManager 把 header 与所有 SessionEntry 追加到 JSONL，并维护 byId 与 leafId。appendMessage() 把 parentId 固定为当前 leaf 后推进 leaf；branch() 只把 leaf 指回已有节点，下一次 append 自然生成新分支。buildSessionPath() 从 leaf 沿 parentId 回溯再反转；buildContextEntries() 若遇到 compaction，仅返回最新摘要、firstKeptEntryId 起的保留前缀以及 compaction 之后条目。CustomEntry 不进入上下文，CustomMessageEntry 才会投影。",
    evidence: [
      { file: "packages/coding-agent/src/core/session-manager.ts", symbol: "SessionEntry / buildSessionPath", lineStart: 46, lineEnd: 172, kind: "代码事实", note: "所有条目共享 id、parentId、timestamp；custom state 与 custom message 明确区分是否进入模型上下文。" },
      { file: "packages/coding-agent/src/core/session-manager.ts", symbol: "buildContextEntries", lineStart: 334, lineEnd: 456, kind: "代码事实", note: "活动路径由 leaf 回溯；最新 compaction 重新定义模型可见前缀，而不是删除 JSONL 旧行。" },
      { file: "packages/coding-agent/src/core/session-manager.ts", symbol: "_appendEntry / appendMessage", lineStart: 1044, lineEnd: 1067, kind: "代码事实", note: "新条目绑定当前 leaf，更新内存索引和 leaf 后追加到文件，形成天然树边。" },
      { file: "packages/coding-agent/src/core/session-manager.ts", symbol: "branch / branchWithSummary", lineStart: 1354, lineEnd: 1405, kind: "代码事实", note: "普通 branch 只移动 leaf；带 summary 的分支先移动 leaf 再追加 branch_summary，旧路径完全保留。" },
    ],
    trace: [
      { name: "append entry", input: "最终消息、模型变化、摘要或扩展条目", responsibility: "生成唯一 id，以当前 leaf 作为 parentId，并追加一行 JSON。", output: "新的 SessionEntry", anchor: "appendMessage · L1057" },
      { name: "advance leaf", input: "刚追加的 entry id", responsibility: "更新当前分支指针；文件里其他分支和孤立路径不受影响。", output: "新的活动叶子", anchor: "_appendEntry · L1044" },
      { name: "branch()", input: "任意已存在 entry id", responsibility: "只把 leaf 移到目标，不改写、不删除，也不复制历史。", output: "下一次 append 的新父节点", anchor: "branch · L1360" },
      { name: "walk to root", input: "当前 leaf 与 byId 索引", responsibility: "沿 parentId 反向收集再 reverse，得到唯一活动路径。", output: "root-to-leaf entries", anchor: "buildSessionPath · L334" },
      { name: "compaction projection", input: "活动路径与最新 CompactionEntry", responsibility: "用 summary + kept suffix 替换旧前缀在模型视图中的位置。", output: "buildSessionContext 的 AgentMessage[]", anchor: "buildContextEntries · L418" },
    ],
  },
  P08: {
    architecture: "DefaultResourceLoader.reload() 若需要项目信任，先把 projectTrusted 强制设为 false，只加载全局/CLI 最小扩展集来运行信任决策；确认后重新加载 settings，解析 package resources，再分别收集 extensions、skills、prompts、themes 与来源 metadata/diagnostics。ExtensionRuntime.invalidate() 在 session replacement 或 reload 时写入 staleMessage 并注销 EventBus subscriptions；所有 API 方法先 assertActive，因此捕获的旧 ctx 会明确报错，而不是悄悄操作新会话。",
    evidence: [
      { file: "packages/coding-agent/src/core/resource-loader.ts", symbol: "ResourceLoader contract", lineStart: 29, lineEnd: 51, kind: "代码事实", note: "统一接口同时返回资源和 diagnostics，并把 system prompt、append prompt 与 AGENTS files 当作独立来源。" },
      { file: "packages/coding-agent/src/core/resource-loader.ts", symbol: "loadProjectTrustExtensions / reload", lineStart: 379, lineEnd: 465, kind: "代码事实", note: "信任 bootstrap 明确排除 project-local code；确认后才解析最终 package 路径和扩展集合。" },
      { file: "packages/coding-agent/src/core/extensions/loader.ts", symbol: "ExtensionRuntime.invalidate", lineStart: 180, lineEnd: 241, kind: "代码事实", note: "旧 runtime 被写入稳定的 stale-context 错误，并清空所有追踪的 EventBus subscription，防止热重载泄漏。" },
      { file: "packages/coding-agent/src/core/extensions/loader.ts", symbol: "createExtensionAPI", lineStart: 244, lineEnd: 302, kind: "代码事实", note: "on/registerTool/registerCommand/registerShortcut 都先 assertActive，再写入当前 Extension 的独立 maps；失效 ctx 无法继续注册。" },
    ],
    trace: [
      { name: "untrusted bootstrap", input: "全局、临时 CLI 与候选项目扩展路径", responsibility: "强制 projectTrusted=false，只加载可用于信任询问的最小代码集合。", output: "preTrustExtensions", anchor: "resource-loader.ts · L379" },
      { name: "resolve trust", input: "bootstrap extension 能力与用户/宿主决策", responsibility: "确定项目级可执行资源是否允许进入当前进程。", output: "SettingsManager.projectTrusted", anchor: "reload · L394" },
      { name: "package resolve", input: "受信 settings、global/project/CLI paths", responsibility: "解析各资源的 enabled 状态、scope、origin 与 source metadata。", output: "分类型 ResolvedResource[]", anchor: "reload · L403" },
      { name: "extension factory", input: "每个已允许 TypeScript module 与新 ExtensionRuntime", responsibility: "用受限 API 收集 handlers、tools、commands、flags、shortcuts，不直接改 Agent core。", output: "Extension maps 或可定位 error", anchor: "loadExtension · L490" },
      { name: "invalidate old runtime", input: "reload 或 session replacement", responsibility: "使旧 ctx 的 assertActive 失败，并注销旧 EventBus listeners。", output: "不会跨会话残留的扩展边界", anchor: "loader.ts · L206" },
    ],
  },
};

const projects = {
  dsh: {
    title: "拆解 DeepSeek Harness",
    label: "DSH",
    accent: "#4f8df7",
    intro: "一个把模型、工具、会话、循环和 UI 全部做成插件的 Agent Harness，如何靠 Cordis 组合成产品。",
    repo: "https://github.com/deepseek-ai/deepseek-harness",
    branch: "master",
    revision: "47f943859bef60e4160492346772ded9b24f765a",
    language: "TypeScript · Cordis",
    lessons: dshLessons,
  },
  pi: {
    title: "拆解 PI Agent",
    label: "PI Agent",
    accent: "#ef684c",
    intro: "一个极简终端 Coding Harness，如何用分层包、会话树与扩展系统，把工作流选择权交还给使用者。",
    repo: "https://github.com/badlogic/pi-mono",
    branch: "main",
    revision: "d3ab2af969d64997338253c9151190aa1bc33580",
    language: "TypeScript · TUI",
    lessons: piLessons,
  },
  nanobot: {
    title: "拆解 nanobot",
    label: "nanobot",
    accent: "#ffb11b",
    intro: "从两只 asyncio.Queue 到可恢复 Turn、受治理上下文、分批工具、原子 JSONL、Dream 记忆事务与 Gateway 资源所有权：拆开一只真正进入产品阶段的个人 Agent。",
    repo: "https://github.com/HKUDS/nanobot",
    branch: "main",
    revision: "c27b1f14c3695da233a7733a478d66ef6d6943d4",
    language: "Python · React",
    lessons: nanobotLessons,
  },
  claude: {
    title: "拆解 Claude Code 复原版",
    label: "Claude Code 复原版",
    accent: "#d97757",
    intro: "基于 claude-code-best 的第三方逆向复原源码，追 CLI 导入拓扑、REPL/QueryEngine 双产品壳、显式恢复状态机、确定性工具提交、权限决策格与可恢复 JSONL。",
    repo: "https://github.com/claude-code-best/claude-code",
    branch: "main",
    revision: "3bb6b5746238c418138eb96d57765d79012edd96",
    language: "TypeScript · React Ink",
    lessons: claudeLessons,
  },
  openclaw: {
    title: "拆解 OpenClaw",
    label: "OpenClaw",
    accent: "#17a589",
    intro: "从一次渠道事件开始，沿 admission、路由、会话、Harness、运行时世代、工具权限与投递结算，拆开一个真正以所有权边界组织的个人 Agent 操作系统。",
    repo: "https://github.com/openclaw/openclaw",
    branch: "main",
    revision: "0a6a1d94192b5ffe3532df0195ac383f53b4b772",
    language: "TypeScript · Gateway",
    lessons: openclawLessons,
  },
} as const;

const courseOverviews: Record<ProjectKey, CourseOverviewData> = {
  dsh: {
    eyebrow: "ROUTE A · COMPOSABLE HARNESS",
    headline: "如果 Agent 的骨架也能随时替换，会发生什么？",
    thesis: "DSH 的核心设计不是“多做几个插件”，而是把模型、工具、会话、循环与产品入口都放进同一棵可组合、可撤销的插件树。",
    tension: "普通框架通常先造一个稳定核心，再给外围留扩展点；DSH 反过来问：为什么核心本身不能也是插件？",
    principles: [
      { title: "一切能力都可组合", detail: "模型、工具、Session、Agent Loop 和 UI 没有谁拥有永久特权，它们都通过 ctx 安装和协作。" },
      { title: "副作用必须能撤回", detail: "监听器、服务与资源跟随 scope 生命周期；卸载插件时，它留下的行为也应该一起消失。" },
      { title: "产品是一棵配置树", detail: "Profile 选择形态，Bundle 展开能力，patch 精确覆盖节点；Web 与 Headless 只是不同组合。" },
    ],
    journey: ["Surface", "Profile / Bundle", "Context", "Agent Loop", "LLM / Tools", "SessionEvent"],
    questions: [
      { question: "所有东西都是插件，启动顺序会不会失控？", answer: "Profile、Bundle 与稳定 id 把组合顺序显式化；Cordis scope 再负责生命周期与回收。" },
      { question: "为什么会话真源不是 messages 数组？", answer: "messages 只是模型视图；追加式 SessionEvent 才能同时支持回放、分支、UI 轨迹与审计。" },
      { question: "换一个沙箱，为什么不必重写所有工具？", answer: "工具消费统一 seam；在局部 scope 替换 provider，就能让整组消费者进入新的执行世界。" },
    ],
    bestFor: ["需要多产品形态共享同一内核", "需要替换模型、文件系统或执行环境", "重视生命周期、审计与可恢复性"],
    tradeoffs: ["抽象密度高，初读源码不如线性调用直接", "插件顺序与作用域需要严格设计", "小项目可能暂时用不到全部组合能力"],
  },
  pi: {
    eyebrow: "ROUTE B · EVENT BARRIERS & PRODUCT PROJECTION",
    headline: "一个小循环，怎样长成可提交、可分支的产品？",
    thesis: "当前 PI 产品由经典 Agent 循环和 AgentSession 协作：内核发出可等待事件，产品层在同一屏障里完成扩展、持久化与恢复；模型、上下文和会话都通过显式投影隔离。",
    tension: "目录里同时出现稳定 Agent 与公开的 vNext AgentHarness；学习者必须先用真实调用方与未实现分支判断成熟度，再讨论架构愿景。",
    principles: [
      { title: "事件也是提交屏障", detail: "Agent 先更新状态，再 await AgentSession listener；持久化和扩展完成后才进入工具或真正 idle。" },
      { title: "每一层只投影下一层所需视图", detail: "Provider 统一流，transform/convert 统一模型上下文，leaf/compaction 统一活动会话路径。" },
      { title: "扩展代码有信任和代际边界", detail: "项目扩展在信任确认后加载；reload 后旧 Context 主动失效，不能跨会话留下捕获引用。" },
    ],
    journey: ["Product call path", "pi-ai Provider", "Nested Agent loops", "Tool batch", "AgentSession barrier", "JSONL projection"],
    questions: [
      { question: "当前 Coding Agent 用的是 AgentHarness 吗？", answer: "不是。固定提交中的 sdk.ts 仍创建 Agent + AgentSession；AgentHarness 的 prompt、steer、resume 等主方法仍抛 HarnessNotImplemented。" },
      { question: "Steering 会立刻打断当前工具吗？", answer: "不会。当前实现会完成本次 assistant 的整个工具批次，在 turn_end 之后才 drain steering；follow-up 更晚，只在本应停止时进入。" },
      { question: "为什么 agent_end 还不等于 idle？", answer: "Agent 会等待所有 agent_end listeners 完成；AgentSession 可能仍在持久化、通知扩展或安排恢复，finishRun 后才真正 idle。" },
    ],
    bestFor: ["希望理解事件驱动 Agent 如何提交产品状态", "需要多模型、自定义消息与可分支会话", "关心扩展热重载和项目代码信任边界"],
    tradeoffs: ["经典 Agent 与 vNext Harness 同仓会提高阅读歧义", "当前 JSONL SessionManager 的同步文件写入仍是产品层约束", "AgentHarness 设计很完整，但公开 API 的核心执行仍在施工"],
  },
  nanobot: {
    eyebrow: "ROUTE C · DURABLE PERSONAL AGENT",
    headline: "轻量只是入口；真正的难题是让一轮 Agent 可提交、可恢复、可长期运行",
    thesis: "nanobot 的核心设计不是某个聪明 Prompt，而是把五类边界接起来：MessageBus 统一信封，AgentLoop 管产品事务，Runner 管模型事务，Session/Memory 管不同时间尺度，Gateway 管长期资源所有权。",
    tension: "源码已经远超‘教学用小机器人’：中途注入、工具 checkpoint、provider 私有续接、上下文副本治理、原子会话、Dream Git 审计都进入了主路径。阅读难点是不要把同名的 history、memory、summary、runtime state 混成一个东西。",
    principles: [
      { title: "先划清提交边界", detail: "同会话 lock、七阶段 Turn、工具前后 checkpoint 与 save-before-respond，让取消、重试和 UI 观察都围绕同一份已提交状态。" },
      { title: "存储、投影与治理分开", detail: "Session 保存事实，ContextBuilder 组装来源，ContextGovernor 只修模型副本；压缩推进归档游标，不覆盖原 transcript。" },
      { title: "后台智能也必须受事务约束", detail: "Dream 只有最小文件权限，成功才推进 cursor，提交说明来自真实 diff；失败不会把尚未学习的历史标成已消费。" },
    ],
    journey: ["Envelope + session routing", "Seven-stage Turn", "Three context projections", "Tool batching", "Atomic Session + archive cursor", "Dream + Gateway ownership"],
    questions: [
      { question: "MessageBus 是否已经保证消息顺序？", answer: "只保证单只 asyncio.Queue 的取放顺序。per-session 串行、跨 session 并发、活跃轮次注入和 leftover 重发全部由 AgentLoop 负责。" },
      { question: "Compaction 会删除旧 Session 消息吗？", answer: "主 token consolidation 不会；它把旧前缀摘要或 raw archive 到 history.jsonl，推进 last_consolidated。Session 仍保留消息，模型重放只投影近期合法后缀与摘要。" },
      { question: "Dream 如何证明自己真的更新了记忆？", answer: "它不靠最终回答自证。Gateway 检查 clean completion 与工具错误，MemoryStore 读取真实 worktree diff，再用 diff 生成 Git commit；没有 diff 就不提交。" },
    ],
    bestFor: ["想理解个人 Agent 如何从 demo 进入可恢复产品", "需要中途插话、多渠道、长会话与后台记忆", "希望学习 Python async 系统的资源所有权与持久化边界"],
    tradeoffs: ["薄 MessageBus 没有内建 durable queue、ack 或背压策略", "Session 保存采用整文件原子重写，历史继续增长会带来 I/O 成本", "Gateway 与 WebUI/Channel 条件持续增多，composition root 已经是主要复杂度热点"],
  },
  claude: {
    eyebrow: "ROUTE D · RECONSTRUCTED CODING AGENT",
    headline: "真正难的不是模型调用，而是让每条失败路径仍然可恢复、可审计。",
    thesis: "这条路线基于 claude-code-best 的第三方复原实现：CLI 用导入图隔离进程角色；REPL 与 QueryEngine 是两种产品外壳；queryLoop 用显式状态迁移治理模型视图、恢复与工具；权限、JSONL relink、MCP 和插件再把循环约束成产品。",
    tension: "该仓库不是 Anthropic 官方源码，而是项目作者明确标注的逆向工程 / 反编译复原版；它适合学习内部结构，但不能当作官方实现或官方授权版本引用。",
    principles: [
      { title: "共享循环，不强求共享产品壳", detail: "REPL 直接调用 query 并拥有 React/日志状态；ACP/SDK 由 QueryEngine 持有跨轮状态。复用点在 loop，而不是虚构一个统一入口。" },
      { title: "可见顺序与提交顺序分开", detail: "并发工具结果可以按完成时间流给 UI，但 contextModifier 按模型调用顺序提交；速度不应换来非确定状态。" },
      { title: "每个投影都要设计恢复逆过程", detail: "snip、compact、collapse 改模型视图；JSONL 仍追加事实，并以 boundary relink、DAG repair 与 consistency checkpoint 验证 resume。" },
    ],
    journey: ["Import topology", "REPL or QueryEngine shell", "queryLoop State", "Tool commit protocol", "Prompt projections", "JSONL relink + MCP refresh"],
    questions: [
      { question: "当前 REPL 是否经过 QueryEngine？", answer: "不经过。REPL.tsx 直接 for-await query() 并用自己的 hooks 持久化；QueryEngine 注释把 REPL 接入称为 future phase，当前真实构造点包括 ACP。" },
      { question: "Hook 返回 allow 后，Bash 是否必然执行？", answer: "不必然。显式 deny rule 仍覆盖，ask rule 仍要求 canUseTool，interactive/requireCanUseTool 也不能被弱授权跳过。" },
      { question: "为什么 compact boundary 要记录三个 UUID？", answer: "保留后缀已经写入 JSONL，不能改 parentUuid。head/anchor/tail 让读取端只修端点，同时验证保留段完整；缺失时宁可加载完整旧历史。" },
    ],
    bestFor: ["想研究失败恢复与显式状态迁移", "关心确定性工具并发和权限优先级", "需要理解 compaction 的 write→resume 正确性"],
    tradeoffs: ["第三方逆向复原，不代表 Anthropic 官方实现", "大量 feature gate 与产品实验提高阅读成本", "仓库根目录暂无许可证，学习引用需注明来源与性质"],
  },
  openclaw: {
    eyebrow: "ROUTE E · PERSONAL AGENT OS",
    headline: "它的优秀设计，不是功能多，而是每个事实都有明确所有者",
    thesis: "OpenClaw 把‘一次回答’拆成六段可验证承诺：渠道 admission、Agent/会话归属、Harness 选择、快照化运行、分层工具授权、外部投递结算。agent-core 只是其中稳定而可复用的一段。",
    tension: "多数 Agent 框架从 loop 向外不断加 if：渠道身份、热更新、审批、插件和重试最后都挤进 Runner。OpenClaw 的选择相反：让不同变化速度的系统拥有自己的状态、失败边界与清理责任，再通过窄合同交接。",
    principles: [
      { title: "先完成归属，再启动智能", detail: "Channel admission 过滤事件；routing 用 matchedBy、agentId、dmScope 与 sessionKey 固化身份。core 不从 prompt 猜用户是谁。" },
      { title: "可变世界通过 generation 进入", detail: "配置、认证、模型目录与插件 registry 整批构建、原子发布；一次运行持有 exact lease，不在中途换底座。" },
      { title: "能力展示与副作用审批分两道门", detail: "surface policy 先隐藏不可用工具，before_tool_call 再审核最终参数；Hook 能扩展流程，却不能让失败静默放行。" },
    ],
    journey: ["Ownership map", "Two-loop core", "Lane + retry runner", "Channel settlement", "Routing identity", "Generation + tool/plugin boundaries"],
    questions: [
      { question: "为什么 Agent 已经生成 final text，渠道轮次还没结束？", answer: "因为模型完成不等于用户收到。provider send 可能有 deferred finalization、partial success 或 non-visible suppression；delivery owner 结算后才知道能否重试。" },
      { question: "配置刷新为什么不能直接改全局 registry？", answer: "一次运行同时依赖 config、auth、model catalog 与 plugin registry。原地改会产生半新半旧；replacement gate + owner batch + lease 让新旧请求各读完整世代。" },
      { question: "显式选择插件 Harness 失败时，为什么不自动回 OpenClaw？", answer: "显式 runtime 是用户的执行语义。静默回落会换掉工具、线程与安全契约；只有 auto 未命中时才允许兼容性 fallback。" },
    ],
    bestFor: ["研究跨渠道 Agent 的端到端正确性", "学习热更新、并发和资源所有权", "设计多 Agent 路由、工具安全或可替代 runtime"],
    tradeoffs: ["所有权边界多，必须先建立全局调用图", "同一概念常有控制面与运行面两套类型", "正确结算与生命周期管理带来显著实现体量"],
  },
};

const architectureComparison = [
  { key: "dsh" as const, name: "DSH", belief: "边界必须可替换", strength: "插件组合与能力换骨", cost: "抽象密度最高" },
  { key: "pi" as const, name: "PI Agent", belief: "核心应该尽可能小", strength: "工作流可塑与会话分支", cost: "产品策略需要自己选择" },
  { key: "nanobot" as const, name: "nanobot", belief: "调用链应该直接可读", strength: "清晰分层与快速上手", cost: "组合自由度相对克制" },
  { key: "claude" as const, name: "Claude Code 复原版", belief: "每条失败路径都要有恢复逆过程", strength: "状态迁移、权限与 transcript 往返正确性", cost: "第三方逆向复原且规模庞大" },
  { key: "openclaw" as const, name: "OpenClaw", belief: "个人 Agent 需要完整控制平面", strength: "跨渠道、运行时与插件生态", cost: "系统与运维复杂度最高" },
];

function routeFromHash(): RouteKey {
  if (typeof window === "undefined") return "home";
  const route = window.location.hash.replace("#/", "").split("/")[0];
  if (route === "dsh" || route === "pi" || route === "nanobot" || route === "claude" || route === "openclaw" || route === "compare") return route;
  return "home";
}

export default function Home() {
  const [route, setRoute] = useState<RouteKey>("home");
  const [lessonId, setLessonId] = useState<Record<ProjectKey, string | null>>({ dsh: null, pi: null, nanobot: null, claude: null, openclaw: null });
  const [tab, setTab] = useState<"lecture" | "source">("lecture");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = routeFromHash();
      setRoute(next);
      const bits = window.location.hash.replace("#/", "").split("/");
      if (next === "dsh" || next === "pi" || next === "nanobot" || next === "claude" || next === "openclaw") {
        const valid = bits[1] && projects[next].lessons.some((lesson) => lesson.id === bits[1]);
        setLessonId((current) => ({ ...current, [next]: valid ? bits[1] : null }));
      }
      setMenuOpen(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const navigate = (next: RouteKey, lesson?: string) => {
    window.location.hash = next === "home" ? "#/" : `#/${next}${lesson ? `/${lesson}` : ""}`;
  };

  const selectLesson = (project: ProjectKey, id: string) => {
    setLessonId((current) => ({ ...current, [project]: id }));
    setTab("lecture");
    window.location.hash = `#/${project}/${id}`;
  };

  const showOverview = (project: ProjectKey) => {
    setLessonId((current) => ({ ...current, [project]: null }));
    window.location.hash = `#/${project}`;
  };

  return (
    <div className="site-shell">
      <Header route={route} navigate={navigate} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      {route === "home" && <Landing navigate={navigate} />}
      {(route === "dsh" || route === "pi" || route === "nanobot" || route === "claude" || route === "openclaw") && (
        <CoursePage
          projectKey={route}
          selectedId={lessonId[route]}
          selectLesson={selectLesson}
          showOverview={showOverview}
          tab={tab}
          setTab={setTab}
        />
      )}
      {route === "compare" && <Compare navigate={navigate} />}
    </div>
  );
}

function Header({
  route,
  navigate,
  menuOpen,
  setMenuOpen,
}: {
  route: RouteKey;
  navigate: (route: RouteKey) => void;
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
}) {
  const [dark, setDark] = useState(false);
  const sourceRepo = "https://github.com/yu-xin-c/agent-unpacked";

  useEffect(() => {
    const saved = window.localStorage.getItem("agent-unpacked-theme") === "dark";
    const frame = window.requestAnimationFrame(() => {
      setDark(saved);
      document.documentElement.dataset.theme = saved ? "dark" : "light";
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("agent-unpacked-theme", next ? "dark" : "light");
  };

  return (
    <header className="topbar">
      <button className="brand" onClick={() => navigate("home")} aria-label="返回首页">
        <span className="brand-mark"><i /><i /></span>
        <span className="brand-copy">
          <span className="brand-name">agent-unpacked</span>
          <span className="brand-sub">来自于 Stellar鱼 的教程</span>
        </span>
      </button>
      <button className="mobile-menu" aria-label="打开导航" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      <nav className={menuOpen ? "topnav open" : "topnav"} aria-label="主导航">
        {([
          ["home", "学习入口"],
          ["dsh", "拆 DSH"],
          ["pi", "拆 PI"],
          ["nanobot", "拆 nanobot"],
          ["claude", "拆 Claude"],
          ["openclaw", "拆 OpenClaw"],
          ["compare", "横向对照"],
        ] as [RouteKey, string][]).map(([key, label]) => (
          <button key={key} className={route === key ? "active" : ""} onClick={() => navigate(key)}>{label}</button>
        ))}
        <a className="github-button" href={sourceRepo} target="_blank" rel="noreferrer" aria-label="查看 Stellar鱼 教程 GitHub">GH</a>
        <button className="theme-button" onClick={toggleTheme} aria-label="切换明暗主题">{dark ? "☀" : "◐"}</button>
      </nav>
    </header>
  );
}

function Landing({ navigate }: { navigate: (route: RouteKey) => void }) {
  return (
    <main className="landing">
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span /> SOURCE-GUIDED · 逐层拆解</div>
          <h1>别只会用 Agent，<br /><em>看懂它为什么能工作。</em></h1>
          <p>五条源码路线，每课都从真实文件和符号出发：先跑调用链，再核对代码证据，最后用失败实验验证状态、权限与生命周期边界。</p>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => navigate("dsh")}>从 DSH 开始 <span>→</span></button>
            <button className="text-action" onClick={() => navigate("compare")}>先看五种架构差异</button>
          </div>
          <div className="hero-stats">
            <div><strong>40</strong><span>节架构课</span></div>
            <div><strong>80+</strong><span>源码锚点</span></div>
            <div><strong>40</strong><span>动手实验</span></div>
            <div><strong>5</strong><span>源码路线</span></div>
          </div>
        </div>
        <SystemSketch />
      </section>

      <section className="route-section">
        <div className="section-heading">
          <span>选择一条路线</span>
          <p>五个项目从同一个 Agent 问题出发，给出插件组合、极简扩展、应用分层、控制协议与个人 Agent OS 五种答案。</p>
        </div>
        <div className="route-cards">
          <RouteCard project="dsh" navigate={navigate} />
          <RouteCard project="pi" navigate={navigate} />
          <RouteCard project="nanobot" navigate={navigate} />
          <RouteCard project="claude" navigate={navigate} />
          <RouteCard project="openclaw" navigate={navigate} />
        </div>
      </section>

      <section className="method-strip">
        <span className="method-number">00</span>
        <div><small>阅读方法</small><h2>每一层都问同样的四个问题</h2></div>
        {["输入是什么？", "状态归谁？", "扩展点在哪？", "失败如何收口？"].map((item, index) => (
          <div className="method-question" key={item}><span>0{index + 1}</span>{item}</div>
        ))}
      </section>
    </main>
  );
}

function SystemSketch() {
  return (
    <div className="system-sketch" aria-label="Agent 系统分层示意图">
      <div className="sketch-caption"><span>LIVE SYSTEM MAP</span><i /></div>
      <div className="sketch-layer input-layer">
        <small>01 · SURFACE</small>
        <div><span>CLI</span><span>WEB</span><span>CHAT</span></div>
      </div>
      <div className="sketch-arrow">↓ <span>统一输入</span></div>
      <div className="sketch-layer core-layer">
        <small>02 · AGENT CORE</small>
        <div className="loop-ring"><b>CONTEXT</b><strong>AGENT<br />LOOP</strong><b>STATE</b></div>
      </div>
      <div className="sketch-branches">
        <div><small>03A</small><strong>LLM</strong><span>provider</span></div>
        <div><small>03B</small><strong>TOOLS</strong><span>execute</span></div>
        <div><small>03C</small><strong>MEMORY</strong><span>persist</span></div>
      </div>
      <div className="sketch-note">真正的复杂度，不在 while；在边界。</div>
    </div>
  );
}

function RouteCard({ project, navigate }: { project: ProjectKey; navigate: (route: RouteKey) => void }) {
  const data = projects[project];
  const routeIndex: Record<ProjectKey, string> = { dsh: "ROUTE A", pi: "ROUTE B", nanobot: "ROUTE C", claude: "ROUTE D", openclaw: "ROUTE E" };
  const routeIcon: Record<ProjectKey, string> = { dsh: "dsh / core", pi: "pi / agent", nanobot: "nano / bot", claude: "claude / sdk", openclaw: "open / claw" };
  return (
    <button className={`route-card ${project}`} onClick={() => navigate(project)}>
      <div className="route-card-top">
        <span className="route-index">{routeIndex[project]}</span>
        <span className="route-lang">{data.language}</span>
      </div>
      <div className="route-icon">{routeIcon[project]}</div>
      <h2>{data.title}</h2>
      <p>{data.intro}</p>
      <div className="route-modules">
        {[...new Set(data.lessons.map((lesson) => lesson.group))].map((group, index) => <span key={group}>{String(index + 1).padStart(2, "0")} {group}</span>)}
      </div>
      <div className="route-footer"><span>{data.lessons.length} LESSONS</span><b>进入路线 →</b></div>
    </button>
  );
}

function CoursePage({
  projectKey,
  selectedId,
  selectLesson,
  showOverview,
  tab,
  setTab,
}: {
  projectKey: ProjectKey;
  selectedId: string | null;
  selectLesson: (project: ProjectKey, id: string) => void;
  showOverview: (project: ProjectKey) => void;
  tab: "lecture" | "source";
  setTab: (tab: "lecture" | "source") => void;
}) {
  const data = projects[projectKey];
  const lesson = selectedId ? data.lessons.find((item) => item.id === selectedId) ?? null : null;
  const index = lesson ? data.lessons.findIndex((item) => item.id === lesson.id) : -1;
  const groups = useMemo(() => [...new Set(data.lessons.map((item) => item.group))], [data.lessons]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSidebarCollapsed(window.localStorage.getItem("agent-unpacked-sidebar-collapsed") === "true");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    window.localStorage.setItem("agent-unpacked-sidebar-collapsed", String(next));
  };

  return (
    <div className={`course-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="course-sidebar" aria-label={`${data.label} 课程侧边栏`}>
        <div className="sidebar-topline">
          <div className="course-identity">
            <small>当前路线</small>
            <strong>{data.title}</strong>
            <span>{data.language}</span>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!sidebarCollapsed}
            aria-controls="course-sidebar-content"
            aria-label={sidebarCollapsed ? "展开课程侧边栏" : "收起课程侧边栏"}
            title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            <span aria-hidden="true">{sidebarCollapsed ? "→" : "←"}</span>
          </button>
        </div>
        <span className="collapsed-route-mark" aria-hidden={!sidebarCollapsed}>{data.title}</span>
        <div id="course-sidebar-content" className="course-sidebar-content" aria-hidden={sidebarCollapsed}>
          <button className={`overview-nav-button ${lesson ? "" : "selected"}`} onClick={() => showOverview(projectKey)}>
            <span>00</span><b>路线总览 · 先看全局</b>
          </button>
          <nav aria-label={`${data.label} 课程目录`}>
            {groups.map((group) => {
              const lessons = data.lessons.filter((item) => item.group === group);
              return (
                <div className="lesson-group" key={group}>
                  <div className="group-name"><i style={{ background: lessons[0].groupColor }} />{group}</div>
                  {lessons.map((item) => (
                    <button key={item.id} className={item.id === lesson?.id ? "selected" : ""} onClick={() => selectLesson(projectKey, item.id)}>
                      <span>{item.id}</span><b>{item.title.split("：")[0]}</b>
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          <a href={data.repo} target="_blank" rel="noreferrer" className="repo-link">查看官方源码 <span>↗</span></a>
        </div>
      </aside>

      <main className={`lesson-main ${lesson ? "" : "course-overview-main"}`}>
        {lesson ? (
          <>
            <div className="breadcrumbs"><span>学习路径</span><i>/</i><span>{lesson.group}</span><i>/</i><b>{lesson.id}</b></div>
            <div className="lesson-kicker"><span>{lesson.id}</span>{lesson.kicker}</div>
            <h1>{lesson.title}</h1>
            <p className="lesson-deck">{lesson.takeaway}</p>

            <div className="lesson-tabs">
              <button className={tab === "lecture" ? "active" : ""} onClick={() => setTab("lecture")}>讲义</button>
              <button className={tab === "source" ? "active" : ""} onClick={() => setTab("source")}>源码地图 <span>{lesson.files.length}</span></button>
            </div>

            {tab === "lecture" ? <Lecture lesson={lesson} project={projectKey} /> : <SourceMap lesson={lesson} project={projectKey} />}

            <div className="lesson-pagination">
              <button onClick={() => index === 0 ? showOverview(projectKey) : selectLesson(projectKey, data.lessons[index - 1].id)}>
                <span>← {index === 0 ? "路线总览" : "上一课"}</span><b>{index === 0 ? "回到全局设计" : data.lessons[index - 1].title}</b>
              </button>
              <button className="next" disabled={index === data.lessons.length - 1} onClick={() => selectLesson(projectKey, data.lessons[index + 1]?.id)}>
                <span>下一课 →</span><b>{data.lessons[index + 1]?.title ?? "路线完成"}</b>
              </button>
            </div>
          </>
        ) : (
          <CourseOverview project={projectKey} selectLesson={selectLesson} />
        )}
      </main>

      <aside className="lesson-rail">
        {lesson ? (
          <>
            <div className="rail-progress"><span>路线进度</span><b>{String(index + 1).padStart(2, "0")} / {String(data.lessons.length).padStart(2, "0")}</b><i><em style={{ width: `${((index + 1) / data.lessons.length) * 100}%`, background: data.accent }} /></i></div>
            <div className="rail-toc"><span>本页</span><a href="#start">问题与判断</a><a href="#flow">机制怎么运转</a><a href="#evidence">源码如何证明</a><a href="#invariants">不能破坏什么</a><a href="#failure">怎样验证</a><a href="#review">结论与边界</a></div>
            <div className="rail-note"><span>读源码时只问三件事</span><p>数据从哪来、状态存在哪、失败停在哪。先回答清楚，再讨论抽象名词。</p></div>
          </>
        ) : (
          <>
            <div className="rail-progress"><span>路线进度</span><b>00 / {String(data.lessons.length).padStart(2, "0")}</b><i><em style={{ width: "4%", background: data.accent }} /></i></div>
            <div className="rail-toc"><span>总览目录</span><a href="#core-idea">核心理念</a><a href="#design-gems">优秀设计</a><a href="#differences">五种架构区别</a><a href="#journey">完整请求旅程</a><a href="#course-map">八课路线图</a><a href="#curiosity">关键悬念</a><a href="#fit">适合与代价</a></div>
            <div className="rail-note"><span>总—分阅读法</span><p>先带着全局问题看八个局部，学完每一课后再回来检查：它究竟改变了整套系统的哪条边界？</p></div>
          </>
        )}
      </aside>
    </div>
  );
}

function CourseOverview({
  project,
  selectLesson,
}: {
  project: ProjectKey;
  selectLesson: (project: ProjectKey, id: string) => void;
}) {
  const data = projects[project];
  const overview = courseOverviews[project];

  return (
    <article className="course-overview">
      <header className="overview-hero">
        <div className="overview-eyebrow"><span style={{ background: data.accent }} />{overview.eyebrow}</div>
        <div className="overview-count">00 / {String(data.lessons.length).padStart(2, "0")}</div>
        <h1>{overview.headline}</h1>
        <p>{overview.thesis}</p>
        <div className="overview-actions">
          <button onClick={() => selectLesson(project, data.lessons[0].id)}>从 {data.lessons[0].id} 开始拆解 <span>→</span></button>
          <a href="#design-gems">先看它最值得学的设计</a>
        </div>
        <div className="opening-prompt">
          <span>开场思考</span>
          <p>想象一次请求正在调用工具，用户突然补充新要求，同时系统还要保存历史并允许下次继续。<b>究竟由谁决定现在该继续、暂停、改写还是结束？</b></p>
        </div>
      </header>

      <section id="core-idea" className="overview-section">
        <div className="overview-section-head"><span>01</span><div><small>THE BIG IDEA</small><h2>先抓住一条核心设计理念</h2></div></div>
        <blockquote>{overview.tension}</blockquote>
        <div className="principle-grid">
          {overview.principles.map((principle, index) => (
            <div key={principle.title}><span>0{index + 1}</span><h3>{principle.title}</h3><p>{principle.detail}</p></div>
          ))}
        </div>
      </section>

      <section id="design-gems" className="overview-section">
        <div className="overview-section-head"><span>02</span><div><small>SIGNATURE DESIGNS</small><h2>单独拆：这个系统最值得学的优秀设计</h2></div></div>
        <p className="overview-lead">不做“功能很多”的表面总结。每一项都对照常规写法，解释它为何这样选、换来了什么，以及把复杂度转移到了哪里。</p>
        <div className="design-gem-list">
          {systemDesignGems[project].map((item, index) => (
            <article key={item.name}>
              <header><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.name}</h3></header>
              <div><small>常规做法</small><p>{item.ordinary}</p></div>
              <div><small>它的选择</small><p>{item.choice}</p></div>
              <div><small>架构收益</small><p>{item.payoff}</p></div>
              <div><small>代价 / 边界</small><p>{item.cost}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section id="differences" className="overview-section">
        <div className="overview-section-head"><span>03</span><div><small>SAME PROBLEM, DIFFERENT BET</small><h2>它和另外四种架构，根本区别在哪里</h2></div></div>
        <p className="overview-lead">三者都能完成“模型调用工具”这件事。真正不同的是：当系统变复杂时，它们选择把复杂度放在哪里。</p>
        <div className="architecture-bets" role="table" aria-label="DSH、PI Agent 与 nanobot 核心架构区别">
          <div className="architecture-bet-head" role="row"><span>架构</span><span>它相信什么</span><span>最擅长什么</span><span>需要付出的代价</span></div>
          {architectureComparison.map((item) => (
            <div className={`architecture-bet-row ${item.key === project ? "current" : ""}`} role="row" key={item.key}>
              <strong>{item.name}{item.key === project && <small>当前路线</small>}</strong><p>{item.belief}</p><p>{item.strength}</p><p>{item.cost}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="journey" className="overview-section">
        <div className="overview-section-head"><span>04</span><div><small>ONE REQUEST JOURNEY</small><h2>先把一条完整请求跑通</h2></div></div>
        <p className="overview-lead">后面的八节课，会分别放大这条链路中的一个边界。先看全局动画，再进入局部，你就不会在文件和类型之间迷路。</p>
        <FlowDiagram steps={overview.journey} color={data.accent} />
      </section>

      <section id="course-map" className="overview-section">
        <div className="overview-section-head"><span>05</span><div><small>FROM WHOLE TO PARTS</small><h2>八节课怎样拼成一个完整答案</h2></div></div>
        <div className="overview-course-map">
          {data.lessons.map((lesson, index) => (
            <button key={lesson.id} onClick={() => selectLesson(project, lesson.id)}>
              <span style={{ color: lesson.groupColor }}>{lesson.id}</span>
              <small>{lesson.group}</small>
              <strong>{lesson.title}</strong>
              <p>{lesson.motto}</p>
              <i>{String(index + 1).padStart(2, "0")} / {String(data.lessons.length).padStart(2, "0")} →</i>
            </button>
          ))}
        </div>
      </section>

      <section id="curiosity" className="overview-section">
        <div className="overview-section-head"><span>06</span><div><small>QUESTIONS THAT PULL YOU FORWARD</small><h2>带着这三个悬念去读源码</h2></div></div>
        <div className="curiosity-list">
          {overview.questions.map((item, index) => (
            <details key={item.question}>
              <summary><span>0{index + 1}</span><strong>{item.question}</strong><i>展开线索 ＋</i></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="fit" className="overview-section">
        <div className="overview-section-head"><span>07</span><div><small>WHEN TO CHOOSE IT</small><h2>什么情况下值得学习这套设计</h2></div></div>
        <div className="fit-grid">
          <div><small>更适合</small><h3>当你需要这些能力</h3>{overview.bestFor.map((item) => <p key={item}><span>✓</span>{item}</p>)}</div>
          <div><small>先知道代价</small><h3>它不是免费的午餐</h3>{overview.tradeoffs.map((item) => <p key={item}><span>!</span>{item}</p>)}</div>
        </div>
      </section>

      <footer className="overview-finale">
        <small>READY TO UNPACK?</small>
        <h2>现在你已经看到森林，<br />下一步再去拆第一棵树。</h2>
        <button onClick={() => selectLesson(project, data.lessons[0].id)}>进入 {data.lessons[0].id} · {data.lessons[0].title} <span>→</span></button>
      </footer>
    </article>
  );
}

function repoSourceUrl(project: ProjectKey, file: string, lineStart?: number, lineEnd?: number) {
  const data = projects[project];
  const targetType = /\/[^/]+\.[a-z0-9]+$/i.test(`/${file}`) ? "blob" : "tree";
  const lines = lineStart ? `#L${lineStart}${lineEnd && lineEnd !== lineStart ? `-L${lineEnd}` : ""}` : "";
  return `${data.repo}/${targetType}/${data.revision}/${file}${lines}`;
}

const lessonDrills: Record<string, LessonDrill> = {
  D01: {
    failureTrigger: "在同一插件里注册一个 service、一个事件监听器和两个带日志的 effect；让后注册的 effect 抛错，再 dispose 插件 Fiber。",
    failureSymptom: "安装失败不能留下 service 或 listener；已成功安装的 effect 必须只清理一次，并按后注册先清理的顺序回滚。",
    debugPath: "沿 Registry.plugin → new Fiber → ReflectService.provide / Events.register → Fiber.effect 的 disposer 栈，记录每个副作用归属的 Fiber id。",
    experiment: "写一个最小 Cordis 插件，记录 install-A、install-B、dispose-B、dispose-A；分别测试正常卸载与 B 安装失败，比较最终服务表和监听器数量。",
    deliverable: "一条精确的安装/回滚时间线，以及“副作用—所有者 Fiber—disposer—卸载后可见性”四列表。",
    reviewQuestion: "为什么把 service 写进 Context 还不够，必须让 provide() 进入 fiber.effect()？",
    reviewAnswer: "Context 只解决查找，不解决谁负责撤销。进入 fiber.effect 后，service 与监听器共享同一所有权树，安装失败、热重载和父 scope 销毁才能使用同一条确定性回滚路径。",
  },
  D02: {
    failureTrigger: "准备 base、web bundle、用户 patch 三层，让后两层同时修改同一稳定 id，并让用户层再插入一项；随后制造一次非法 patch。",
    failureSymptom: "合法输入只得到一棵最终树，后层按顺序覆盖前层；非法输入应在 Loader.mount 前失败，不能先启动 base 再留下半套插件。",
    debugPath: "打印 loadProfile 返回的 layer 来源与顺序，比较 layers.flat()、composeEntries() 输出和 Loader 实际 entries，确认中间没有逐层激活。",
    experiment: "调用 composeEntries 两次交换 bundle 顺序，保存两个配置 diff；再运行真实 boot 测试，验证稳定 id override、insert 和 !!js 值都只在最终挂载树中出现。",
    deliverable: "一张 layer→patch→final entry 的来源表、一份顺序交换 diff，以及非法 patch 发生在副作用前的证据。",
    reviewQuestion: "为什么 DSH 要先展平所有 patch，再只调用一次 applyEntryPatches？",
    reviewAnswer: "逐层修改并立即启动会让覆盖顺序同时影响生命周期，失败时还要回滚已经运行的旧层。单次合成把配置顺序变成可审核的纯计算，最终树确认后才进入插件副作用阶段。",
  },
  D03: {
    failureTrigger: "追加一轮 user/assistant/tool 事件，保存旧事件引用后尝试修改嵌套 content；再做 surface replace，并尝试从开放 turn 中间 fork。",
    failureSymptom: "旧事件修改应抛 TypeError；deriveMessages 只反映新 surface，但原 log 仍含被遮蔽事件；开放 turn 边界的 fork 必须拒绝。",
    debugPath: "依次检查 append 前校验、seq 与 deepFreeze、surface replaceGeneration、deriveMessages cache，以及 _forkSeed 对最近 turn/start/end 的判断。",
    experiment: "构造两轮 Session：第一轮闭合、第二轮保持开放。替换第一轮模型表面后比较 events 与 deriveMessages，再分别从第一轮末尾和第二轮中间 fork。",
    deliverable: "三份快照：durable events、surface nodes、derived messages；再附一张合法/非法 fork boundary 表。",
    reviewQuestion: "为什么 surface replace 不能直接删除旧 SessionEvent？",
    reviewAnswer: "删除会破坏审计、分支来源和恢复依据。DSH 让 replace 只改变模型表面，durable log 继续保存旧事实；fork 和其他投影因此仍能引用稳定的 seq 前缀。",
  },
  D04: {
    failureTrigger: "在一个工具 step 运行期间依次发送 inject、steer 与 follow-up，并记录 driver 是否被唤醒、消息在哪个 step/turn 被 claim。",
    failureSymptom: "inject 只能等当前 step 的下一个边界且不主动唤醒；steer 在下一个 step 可见并唤醒；follow-up 必须进入下一 turn。",
    debugPath: "从 delivery method 的 wakeup 参数进入 wakeDriver，再在 turn/start、claim inputs、step end、turn-stopping 和 turn/end 上打时间戳。",
    experiment: "用可控 promise 阻塞模型或工具，在三个时刻分别投递三种消息；输出 SessionEvent 序列，验证消息可见性与唤醒行为是两个独立维度。",
    deliverable: "一张三种 inbox mode 的“投递时刻—唤醒—首次可见 step—所属 turn”矩阵。",
    reviewQuestion: "为什么 inject 与 steer 都面向下一 step，却不能合并成一个 API？",
    reviewAnswer: "两者的可见边界相同，但调度语义不同：steer 必须唤醒已经空闲或中断后的 driver，inject 只补充材料而不改变运行节奏。合并会把产品意图藏进调用时机。",
  },
  D05: {
    failureTrigger: "安排 parallel A、parallel B、exclusive C、parallel D 四个工具，令完成顺序为 B→A→C→D，并让 B 的 post 阶段失败。",
    failureSymptom: "C 必须等待 A/B 全部 settle，D 不能越过 C；Session 结果仍按 A→B→C→D 提交，未启动调用得到可审计 aborted result。",
    debugPath: "记录 executeToolCalls 的 slots、prepareExecution 决策、rolling pool dispatch、每个 promise settle 和 ordered finalize/Session append。",
    experiment: "用延迟和 barrier 工具复现上述批次，分别在 prepare、dispatch、post 三阶段注入错误，比较哪些调用已启动、哪些只生成规范化结果。",
    deliverable: "一张执行甘特图、一次模型顺序提交日志，以及三类失败阶段对应的启动/回收表。",
    reviewQuestion: "为什么 DSH 只允许 dispatch/body 并发，而 prepare 与 finalize 保持模型顺序？",
    reviewAnswer: "prepare 包含审批和 guards，finalize 包含结果语义与 Session 提交；让它们乱序会改变因果关系。只并发真正耗时的 handler body，能保留吞吐又不牺牲可复现状态。",
  },
  D06: {
    failureTrigger: "在 root 注册 toolX，在 child scope 用同名实现 shadow，再创建 grandchild；依次 dispose child 和 root，观察三层 ToolView。",
    failureSymptom: "child/grandchild 先看到局部 toolX，root 不受影响；child dispose 后后代查询回落父实现，且局部 restrictions/listeners 一并消失。",
    debugPath: "追 createScope 写入的 ScopeKey、parent 引用、chainLayers 的 farthest→exact 顺序、ToolRuntime.view 合并和 ScopedLayers.effect disposer。",
    experiment: "让 root/child 的 toolX 返回不同 owner 标签，打印三层 view；再销毁 child，确认查询回落且 store 中 exact layer 被移除。",
    deliverable: "一棵 scope 父子树、每个时刻的 toolX 解析结果，以及 dispose 前后 layer 数量对照。",
    reviewQuestion: "为什么能力可见性与清理必须使用同一条 scope 父链？",
    reviewAnswer: "若查找沿一套继承规则、清理沿另一套所有权规则，局部 provider 可能已经不可见却仍存活，或仍被后代使用却提前销毁。共用父链才能保证 shadow 与回落一致。",
  },
  D07: {
    failureTrigger: "选择一个平衡 surface 区间开始摘要；摘要期间分别追加 log-only event、追加 surface message，并让 summarizer 抛错。",
    failureSymptom: "log-only append 可共存；surface 改变或摘要失败都不能产生 replace，旧 surface 保持不变，但 compaction/end 必须留下错误事实。",
    debugPath: "检查 region 初始 seq、compaction/start、summarizer 输入、commitCompactionBody 的稳定性重验、收益校验与 closing bracket。",
    experiment: "对同一 Session 运行三次 compactRegion：正常、摘要期间 surface mutation、summarizer failure；比较 replaceGeneration、events 尾部和 derived messages。",
    deliverable: "三条事务事件序列，以及“durable log 是否推进 / model surface 是否提交 / 是否允许重试”的结果矩阵。",
    reviewQuestion: "为什么 compaction/start 要在调用摘要模型之前写入日志？",
    reviewAnswer: "压缩本身可能耗时、失败或被取消。先写 start 才能区分未发生、进行中、失败关闭和遗留 orphan；但真正的 surface replace 仍要等摘要完成并重验依据后提交。",
  },
  D08: {
    failureTrigger: "分别用 web 与 headless profile 组合配置，输入同一任务；对比最终 entry tree、启动服务和进入 AgentLoop 后的 SessionEvent。",
    failureSymptom: "两者的 surface/host/task 入口不同，但 Session、LLM、tools、scope 和 AgentLoop 应来自同一 base；headless 不应偷偷启动 HTTP/browser 服务。",
    debugPath: "从 PROFILE_TEMPLATES 到两份 cordis.patch.yml，标出 base 共同项和 surface 增量；再追 headlessStartup service 的 provider 与 runner consumer。",
    experiment: "导出两份配置树做结构 diff，只保留不同条目；给共享 AgentLoop 加事件观察器，确认同一任务的 turn/step 协议不随 surface 改变。",
    deliverable: "一份 web/headless 配置树差异、一张 task/UI→共享 Agent service 的收敛图。",
    reviewQuestion: "如何从源码证明 Web 与 Headless 不是两套 Agent 内核？",
    reviewAnswer: "PROFILE_TEMPLATES 都以 base 开头，差异只在第二个 surface bundle；headless 将 task 作为普通 Cordis service 提供，runner 仍消费 base 中的相同 Session、Tools 与 AgentLoop。",
  },

  P01: {
    failureTrigger: "写两个最小调用：一个经 coding-agent SDK 创建 AgentSession 并 prompt，另一个经 AgentHarness.create 后调用 prompt/steer/resume。",
    failureSymptom: "AgentSession 路径应真实运行；vNext Harness 可以建立部分持久对象，但主方法返回稳定 HarnessNotImplemented，而不是伪装成功。",
    debugPath: "从 package export 反向追真实 new 调用点：sdk.ts 的 new Agent/new AgentSession，与 agent-harness.ts 的 unavailable() 分支分别记录。",
    experiment: "生成“exported / constructed / callable / implemented / used by product”五列表，对 Agent、AgentSession、AgentHarness、JsonlSessionStorage 逐项填证据。",
    deliverable: "一张当前产品路径与 vNext 施工路径的成熟度矩阵，至少包含一个正调用点和一个未实现反证。",
    reviewQuestion: "为什么看到 public export 不能断言 AgentHarness 是 PI 当前主架构？",
    reviewAnswer: "export 只说明 API 可见。真正的产品调用点在 sdk.ts 构造 Agent + AgentSession；Harness 多个关键方法仍统一抛 HarnessNotImplemented，因此必须区分设计目标与运行事实。",
  },
  P02: {
    failureTrigger: "构造一个延迟认证和动态 import 都可能失败的 Provider，再分别让 setup、网络流和终止阶段失败。",
    failureSymptom: "调用方始终收到 start 后的 error terminal event 与 stopReason=error 的 AssistantMessage；不应泄漏厂商异常或留下未终止流。",
    debugPath: "沿 Models.getModel/getAuth → lazyApi/lazyStream → Provider.streamSimple → AssistantMessageEvent terminal，记录失败在哪层被协议化。",
    experiment: "实现 FakeProvider，依次抛认证错误、import 错误和流中错误；用同一事件收集器断言每条路径的开始、增量和唯一终态。",
    deliverable: "三类失败的事件序列表，以及 Provider/Models/API adapter 各自拥有信息的边界表。",
    reviewQuestion: "为什么 Provider 契约同时拥有 catalog、auth 与 stream，而不是拆给三个全局 registry？",
    reviewAnswer: "模型目录、动态凭据和协议实现共同决定一次请求是否有效。让 Provider 统一拥有它们，可避免把 A 厂商模型与 B 厂商认证或不兼容 stream adapter 错误组合。",
  },
  P03: {
    failureTrigger: "在一次带工具的 turn 中排入两条 steering 和两条 follow-up，分别切换 all 与 one-at-a-time queue mode。",
    failureSymptom: "steering 只能在完整工具批次后进入内层下一 turn；follow-up 只能在本来要结束时进入外层；queue mode 只改变每次 drain 数量。",
    debugPath: "在 runLoop 两层 while、turn_end、prepareNextTurn、shouldStopAfterTurn、drain steering 与 drain follow-up 处记录队列长度。",
    experiment: "用确定延迟的 FakeProvider/Tool 生成时间线，比较 all 和 one-at-a-time；确认消息归属边界相同，只是拆成不同次数的模型请求。",
    deliverable: "一张双队列/双循环状态图，以及两种 queue mode 下的 turn 序列对照。",
    reviewQuestion: "为什么 steering 不是硬中断？",
    reviewAnswer: "源码只在一个完整 assistant/tool turn 后 drain steering，已经开始的工具批次先完成并提交。它表达的是“下一步改向”，不是取消当前副作用；硬中断需要另一套 abort 语义。",
  },
  P04: {
    failureTrigger: "持久化 bashExecution、custom、branchSummary 与 compactionSummary 四类消息，再让 transformContext 删除一项、convertToLlm 映射其余项。",
    failureSymptom: "Session/UI 仍保留丰富 AgentMessage；本轮 provider view 只含允许的三角色 Message，excludeFromContext 的 bash 不得泄漏。",
    debugPath: "同时打印 persisted messages、transformContext 输出和 convertToLlm 输出，用 id 对齐每次投影而不是只看文本。",
    experiment: "构造含四种自定义角色的会话，运行一次实际 projection；修改 transformContext 后重复，证明只改变本轮选择，不改 JSONL 原件。",
    deliverable: "一张消息 id 从存储→应用选择→provider 协议的三列投影表。",
    reviewQuestion: "为什么 PI 不直接把所有自定义消息转换后再存成 provider Message？",
    reviewAnswer: "那会丢失 UI、分支摘要和扩展来源等产品语义，并把某个 Provider 的限制写回事实层。保留 AgentMessage 原件，运行时再投影，才能让存储和模型协议独立演进。",
  },
  P05: {
    failureTrigger: "让两个 parallel 工具以 B→A 顺序完成，再加入一个声明 sequential 的工具；分别运行纯并行批次和混合批次。",
    failureSymptom: "纯并行时 end event 可 B 先 A 后，但 ToolResultMessage 必须 A→B；混合批次因一个 sequential 工具整体串行。",
    debugPath: "记录 batch mode scan、ordered prepareToolCall、Promise.all 完成时间、after hook 和第二次按数组顺序发 result 的循环。",
    experiment: "为 A/B 设置 200ms/20ms，给每个 after hook 写入不同标记；再加入 sequential C，比较事件可见顺序、结果顺序和总耗时。",
    deliverable: "两张批次甘特图，以及 end-event order / result-artifact order / terminate decision 三列日志。",
    reviewQuestion: "PI 为什么选择“一个 sequential，整批 sequential”，而不是像 barrier 一样只隔离该调用？",
    reviewAnswer: "当前实现用批次级保守语义避免读写调用互相越过，规则简单且可预测，代价是牺牲部分并发度。教程必须描述真实选择，不能把更复杂的 barrier 调度误写成现状。",
  },
  P06: {
    failureTrigger: "给 message_end listener 延迟 300ms，在 listener 内先通知扩展、再 append JSONL；同时调用 waitForIdle 并记录各时刻。",
    failureSymptom: "Agent state 先更新，但工具下一阶段和 idle 都必须等待 listener；agent_end 可早于真正 settled，JSONL 不能在 idle 后才补写。",
    debugPath: "沿 processEvents reducer→sequential listeners→AgentSession._handleAgentEvent→extension→SessionManager.append→finishRun。",
    experiment: "注册带 deferred promise 的 listener，手动释放前断言 Agent state 已变、waitForIdle 未完成、SessionManager 尚未 append；释放后再核对顺序。",
    deliverable: "一条毫秒级提交时间线，标出 event emitted、state reduced、extension settled、JSONL appended 与 idle。",
    reviewQuestion: "为什么 awaited listener 是提交屏障，而不只是 UI 通知机制？",
    reviewAnswer: "循环会等待 listener promise；AgentSession 又在该 promise 内完成扩展和持久化。因此下一阶段和 waitForIdle 不会越过这些动作，它们属于运行协议的提交路径。",
  },
  P07: {
    failureTrigger: "创建 A→B→C 路径，从 A branch 出 D→E，再在第二条路径写 compaction entry；多次切换 leaf 并 build context。",
    failureSymptom: "JSONL 同时保留 B/C 与 D/E；活动上下文只沿当前 leaf 回根，并仅应用该路径最新 compaction，不得混入另一分支。",
    debugPath: "检查 _appendEntry 的 parentId、leafId 更新、branch 只移动指针、buildSessionPath 回溯和 buildContextEntries 的 latest compaction 选择。",
    experiment: "输出文件行顺序、byId 图、两个 leaf 的 root-to-leaf path 和最终 AgentMessage[]；确认 CustomEntry 不进模型、CustomMessageEntry 才投影。",
    deliverable: "一棵真实 JSONL parentId 树、两条活动路径，以及各自 compaction 前后上下文 diff。",
    reviewQuestion: "为什么 SessionManager 不能按 JSONL 文件行顺序恢复当前对话？",
    reviewAnswer: "文件包含所有分支和非模型条目，行顺序只表示追加时间。当前对话由 leaf 与 parentId 唯一确定，再由 compaction entry 改写模型可见前缀。",
  },
  P08: {
    failureTrigger: "在未信任项目中放置一个注册 tool 和 listener 的扩展；完成信任后加载，再 reload 并调用旧 ExtensionContext。",
    failureSymptom: "信任前项目代码不执行；信任后能力出现；reload 后旧 ctx 的 API 稳定抛 stale-context，旧 EventBus listener 被注销。",
    debugPath: "记录 loadProjectTrustExtensions 的来源过滤、projectTrusted 切换、最终 package resolve、ExtensionRuntime.invalidate 与 assertActive。",
    experiment: "让扩展递增模块副作用计数并订阅事件；检查信任前计数为零、加载后为一、reload 后旧 listener 不再响应且旧 ctx 注册失败。",
    deliverable: "一张资源来源/信任/是否执行矩阵，以及 reload 前后 listener 数量和 stale error 对照。",
    reviewQuestion: "为什么热重载时清 module cache 仍不足够？",
    reviewAnswer: "旧闭包仍持有 EventBus、Session 和注册 maps 的引用。invalidate + assertActive 把跨代使用变成显式错误，并主动撤销订阅；单纯重载模块无法回收这些活对象。",
  },

  N01: {
    failureTrigger: "同时发送同 session 的两条普通消息、另一 session 的一条消息，并在首个 session 活跃时再注入 follow-up。",
    failureSymptom: "同 session 只能串行提交，跨 session 可并发；活跃 session 的普通 follow-up 进入 pending queue，未消费部分在轮次结束后重新发布。",
    debugPath: "从 InboundMessage.session_key、MessageBus.get_inbound 到 AgentLoop.run 的 active session 判断，再追 _dispatch 的 per-session lock 与 semaphore。",
    experiment: "给两个 session 的处理器加入不同 delay，记录 bus dequeue、lock acquire、pending injection、re-publish 和 outbound 时间。",
    deliverable: "一张 session A/B 并发甘特图，以及活跃轮次 pending queue 的入队、消费、回流日志。",
    reviewQuestion: "为什么只读 MessageBus 无法得出 nanobot 的并发语义？",
    reviewAnswer: "Bus 只有统一信封和两只 Queue，不知道 session lock、active run、pending injection 或全局 semaphore。真正的调度所有者是 AgentLoop。",
  },
  N02: {
    failureTrigger: "让 Runner 生成两个工具调用，第一个完成后在 awaiting_tools 与 tools_completed 之间触发 /stop，再恢复同一 session。",
    failureSymptom: "恢复历史必须包含成对 tool_call/tool_result 或可解释的取消结果；已完成工具不应整轮重做，save 仍先于 outbound complete。",
    debugPath: "按七阶段 Turn 记录 restore/compact/command/build/run/save/respond，进入 Runner 后额外记录两个 checkpoint 和取消物化路径。",
    experiment: "用可控工具屏障分别在工具前、首工具后、tools_completed 后取消，重启 SessionStore 后比较下一轮 history 与副作用次数。",
    deliverable: "三种取消时机的 checkpoint、持久消息、重放行为与副作用次数矩阵。",
    reviewQuestion: "为什么 nanobot 需要 Loop 和 Runner 两层，而不是一个 while 完成全部事情？",
    reviewAnswer: "Loop 拥有 session 锁、阶段提交、持久化和投递；Runner 只推进一次模型—工具事务。分层后取消恢复和 durable save 不必侵入模型循环。",
  },
  N03: {
    failureTrigger: "在持久历史中制造 orphan tool result、缺失 result 和超大工具输出，再运行一次 context build 与 model governance。",
    failureSymptom: "Session 原件保持不变；legal replay 先选合法后缀，Builder 组装来源，Governor 只在 model copy 修复协议并离线大结果。",
    debugPath: "保存三个对象的 hash：Session.get_history 输出、ContextBuilder messages、ContextGovernor model copy，并逐项标记哪一层产生差异。",
    experiment: "构造带项目 AGENTS.md、Agent SOUL/USER 和坏工具链的 session，执行三次投影；比较发送前后 Session.messages 是否完全相等。",
    deliverable: "一张 persisted / replay / assembled / model 四列消息 diff，并标注每个删改动作的所有者。",
    reviewQuestion: "为什么 ContextGovernor 必须只改模型副本？",
    reviewAnswer: "它解决 Provider 可接受性和 token 预算，不是修改历史事实。若原地改 Session，下一次保存、审计和 append boundary 都会被一次临时发送策略污染。",
  },
  N04: {
    failureTrigger: "运行 A 获得 ProviderSnapshot 后修改 provider/model/config 并 invalidate，再在 A 未结束时准入运行 B。",
    failureSymptom: "A 全程使用旧 generation；B 在下一次 admit 获得完整新 snapshot；任何运行都不能一半使用旧 provider、一半使用新 catalog。",
    debugPath: "记录 ProviderSpec/factory validation、snapshot signature/generation、watcher.invalidate 和 ModelRuntimeResolver.admit 的时刻与对象身份。",
    experiment: "FakeProvider 在每次 call 回传 generation 标签；阻塞 A、刷新配置、启动 B，断言两个 run 各自只出现一个 generation。",
    deliverable: "一条 A/B 与 config refresh 的时间线，以及两个 immutable LLMRuntime 内容快照。",
    reviewQuestion: "为什么配置 watcher 只 invalidate，而不直接修改运行中的 runtime？",
    reviewAnswer: "直接修改会撕裂一次 turn 的模型、认证、窗口和私有 continuation。invalidate 把变化推迟到下一次 admission，让每个 run 持有自洽快照。",
  },
  N05: {
    failureTrigger: "返回 read-only A、read-only B、write C、read-only D 四个 tool call，并让 B 最先完成。",
    failureSymptom: "A/B 可同批 gather，C 独占并阻止 D 越过；结果消息仍按 A→B→C→D，而未知名或 schema 错误在执行前稳定失败。",
    debugPath: "从 ToolLoader discovery、ToolRegistry.prepare_call 到 _partition_tool_batches 和 _execute_tools，记录 definition 排序、typed params 与 batch 边界。",
    experiment: "为四工具加开始/结束日志和副作用计数，另提交一个近似工具名和错误参数；对照实际执行、提示和结果顺序。",
    deliverable: "一张工具能力声明/批次/开始结束/结果位置表，以及两个 pre-execution 错误样本。",
    reviewQuestion: "为什么并发安全必须是工具能力声明，而不是根据名称维护白名单？",
    reviewAnswer: "调度器需要知道真实副作用和 exclusive 约束，名称无法表达输入相关或插件工具语义。能力声明让内置与第三方工具使用同一协议，默认还可保守地不并发。",
  },
  N06: {
    failureTrigger: "让会话超过压缩阈值，并分别让摘要模型成功、失败、进程在 temp 写完后 replace 前终止。",
    failureSymptom: "成功或 raw fallback 都可推进 last_consolidated；Session.messages 不被删除；中断保存不能留下半个正式 JSONL，旧文件仍可读。",
    debugPath: "检查 token boundary、Consolidator.archive/raw_archive、cursor 更新、provider state 清理，以及 JsonlSessionStore temp→fsync→replace。",
    experiment: "保存压缩前后 session/history 两份 JSONL 和 cursor；故障注入 os.replace 前退出，再重启并验证正式文件、recent legal suffix 与 archived summary。",
    deliverable: "一张 Session/history/cursor 三账本对照，以及原子保存故障前后的文件清单。",
    reviewQuestion: "为什么 last_consolidated 不是删除边界？",
    reviewAnswer: "它只说明哪些旧消息已归档。Session 仍保存原始事实，get_history 还会向前保留近期合法后缀；模型视图与归档进度因此能独立演进。",
  },
  N07: {
    failureTrigger: "准备一批未 dream 的 history，让受限工具先成功编辑 MEMORY.md，再返回 tool error；下一次运行改为 clean completion。",
    failureSymptom: "失败批次不能推进 .dream_cursor，也不能以模型自述宣告完成；成功批次才推进 cursor，并由真实 worktree diff 决定 Git audit commit。",
    debugPath: "记录 history cursor、Dream prompt 中的文件快照、受限 ToolRegistry、process_direct stop reason/tool errors、cursor write 和 git diff。",
    experiment: "尝试写允许文件与越界文件各一次；故意制造工具错误后重跑，核对同一 history 是否被再次处理以及 commit message 是否来自真实 diff。",
    deliverable: "一张允许/拒绝文件矩阵、失败/成功 cursor 对照和实际 Git diff/commit 证据。",
    reviewQuestion: "为什么 Dream 不能在模型说“完成”后立即推进 cursor？",
    reviewAnswer: "模型文本不能证明文件工具成功、权限未越界或改动真实存在。clean stop、无工具错误、真实 diff 和 cursor commit 共同构成可重试事务。",
  },
  N08: {
    failureTrigger: "让 MCP 首次连接失败、一个 channel send 重试一次，并在运行中发 shutdown signal；记录各资源创建和关闭顺序。",
    failureSymptom: "Agent 不应看到半注册 MCP 工具；ChannelManager 自己处理投递重试；退出时长期任务取消，MCP/Channels 关闭并 durable flush sessions。",
    debugPath: "从 gateway composition 的对象身份开始，追 MCP connect、gather task group、outbound dispatcher 与 finally shutdown，不进入 Runner 猜资源所有权。",
    experiment: "用 FakeMCP/FakeChannel 记录 connect/register/send/retry/aclose，启动 Gateway 后触发一条消息和 shutdown，断言同一 registry 被 Agent 与 MCP 共享。",
    deliverable: "一张资源所有权图和完整启动/投递/关闭事件时间线。",
    reviewQuestion: "为什么 MCPProvider 的 connect/aclose 属于 Gateway，而不是 AgentRunner？",
    reviewAnswer: "MCP 连接跨越多个 turn，生命周期与进程相同；Runner 只消费已注册工具。若 Runner 拥有连接，每轮都会重复建立资源并造成并发所有权冲突。",
  },

  C01: {
    failureTrigger: "分别运行 --version、ACP fast path、--bare 默认路径，并采集模块加载列表、启动耗时与常驻内存。",
    failureSymptom: "--version 不加载主程序；专用角色只加载自己的入口并终止；--bare 环境必须在 main 模块求值前生效。",
    debugPath: "从 cli.tsx 第一条 performance shim、argv 分支、每个 dynamic import 到最终 import main，标记任何提前加载完整图的静态 import。",
    experiment: "给模块 loader 增加只读 trace，比较三种 argv 的 import 数量和首个 UI/tool 模块出现位置；删除一个 dynamic boundary 做反例。",
    deliverable: "三种启动角色的 import DAG、模块数/耗时/内存对照，以及一个静态 import 回归样本。",
    reviewQuestion: "为什么 CLI import 图是架构，而不只是性能微优化？",
    reviewAnswer: "同一二进制承载互斥进程角色。导入完整产品会带来初始化副作用、内存和协议污染；动态边界同时定义了每种角色允许拥有的依赖与生命周期。",
  },
  C02: {
    failureTrigger: "用同一 prompt 分别走 REPL 的 query() 与 ACP/SDK 的 QueryEngine.submitMessage，记录事件消费、状态和持久化所有者。",
    failureSymptom: "两者共享 queryLoop 语义，但 REPL 自己拥有 React/log/queue，QueryEngine 自己拥有跨 submit 的 messages/usage/denials；不能伪装成同一个 Session 类。",
    debugPath: "正向追 REPL.tsx onQuery，另一路追 ACP createSessionMethod→new QueryEngine，再在 query() 汇合点与各自 commit 点分叉。",
    experiment: "做双入口事件 trace，给相同 provider/tool 结果；比较共享事件和壳层专有状态，确认 REPL 没有隐式构造 QueryEngine。",
    deliverable: "一张“两种壳—一个 loop—两个 commit owner”的调用图和状态所有权表。",
    reviewQuestion: "为什么源码里保留两个产品壳不一定是重复设计？",
    reviewAnswer: "REPL 需要 React 交互、队列和本地日志，SDK/ACP 需要 headless 跨调用状态。它们复用 queryLoop 的模型—工具语义，但不强迫产品状态服从同一生命周期。",
  },
  C03: {
    failureTrigger: "依次制造 413 overflow、max-output、media error 和流式 fallback，观察 queryLoop 的 transition、guard 与被回收的暂态消息。",
    failureSymptom: "每类恢复只能按具名迁移发生有限次数；fallback 必须 tombstone 孤儿 assistant/tool state；超出 guard 后返回终态，不能无限 continue。",
    debugPath: "记录每次循环入口的完整 State、messagesForQuery 投影步骤、stream terminal 和 collapse/compact/continuation transition reason。",
    experiment: "FakeProvider 按调用次数返回四类错误，再成功；保存每次 provider input 与 next State，检查旧 StreamingToolExecutor 和 tool_use_id 是否泄漏。",
    deliverable: "一张 transition 状态图、每次恢复前后的完整 State diff，以及 guard 终止证据。",
    reviewQuestion: "为什么恢复分支要重写完整 State，而不是只设置一个 retry=true？",
    reviewAnswer: "恢复同时改变 messages、预算、transition、失败 guard 和暂态 executor。完整 State 迁移让每个 continue 的输入可审计，避免遗留上次尝试的 tool 或流式状态。",
  },
  C04: {
    failureTrigger: "两个 concurrency-safe 工具 B 先于 A 完成，并各自返回修改同一 context key 的 modifier；再加入 unsafe 工具作为串行分界。",
    failureSymptom: "UI 消息可以 B 先显示，但 context modifier 必须按 tool_use A→B 提交；unsafe 调用不与相邻安全批次重叠。",
    debugPath: "追 Tool.isConcurrencySafe(input)、partitionToolCalls、并发池 yield、toolUseID modifier map 和按原 blocks 顺序应用的 commit。",
    experiment: "A/B 分别延迟 200/20ms 并 append A/B 到 context；重复运行多次，确认可见顺序受延迟影响但最终 context 始终 A→B。",
    deliverable: "一张完成顺序与提交顺序双时间线，以及多次运行最终 context hash 对照。",
    reviewQuestion: "为什么“消息按完成时间可见、状态按源顺序提交”是合理的双顺序？",
    reviewAnswer: "前者降低用户等待，后者隔离 I/O 抖动对共享状态的影响。把两者混为完成顺序会让相同模型输出产生非确定的下一轮上下文。",
  },
  C05: {
    failureTrigger: "让 PreToolUse Hook 返回 allow 并改写输入，同时组织规则匹配 deny；再测试 ask 与 noninteractive/requireCanUseTool。",
    failureSymptom: "deny 必须覆盖 Hook allow；ask 仍进入 canUseTool；任何拒绝都生成配对 tool_result，但真实 tool.call 副作用计数保持零。",
    debugPath: "保存 raw、Zod-valid、semantic-valid、processed、hook-updated 与 final call input，追 resolveHookPermissionDecision 的优先级和 call boundary。",
    experiment: "构造四组 rule/hook 组合，给工具 body 加计数器；输出最终 PermissionDecision、模型可见拒绝结果和实际副作用次数。",
    deliverable: "一张 deny/ask/allow × hook decision 决策表，以及六个输入版本的字段 diff。",
    reviewQuestion: "为什么 Hook 的 allow 不能被当成最高权限？",
    reviewAnswer: "Hook 是扩展自动化，不应越过组织 deny、用户 ask 或强制交互策略。源码把它作为建议并继续进入规则格，保持安全边界的单调性。",
  },
  C06: {
    failureTrigger: "同时提供 override/coordinator/agent/custom/default system prompt，并在 Managed、User、Project、Local 四层放同名规则与 include。",
    failureSymptom: "system identity 按替换/追加规则稳定解析；memory 按来源和 root→cwd 顺序保留路径，循环 include 被阻止，worktree 不重复注入。",
    debugPath: "分开记录 buildEffectiveSystemPrompt、getSystemContext memoized Git snapshot、getMemoryFiles source ordering 和 getClaudeMds render。",
    experiment: "在临时目录树创建四层 CLAUDE.md 与 include，切换 cwd/worktree；保存最终 prompt 每段的来源、顺序和是否被替换。",
    deliverable: "一张 system prompt 决策表和一份带绝对来源标注的 memory 合并清单。",
    reviewQuestion: "为什么 Prompt 不能被理解为一个不断 concat 的字符串？",
    reviewAnswer: "系统身份、环境快照和 memory 文件有不同所有者、优先级与缓存周期。无条件拼接会造成互相冲突、来源丢失和会话中途漂移。",
  },
  C07: {
    failureTrigger: "触发 compact 并保留一段含并行 tool_use/tool_result 的近期后缀，写入 JSONL 后退出；再删除一个 preservedSegment 端点并 resume。",
    failureSymptom: "正常恢复重连 head/anchor/tail 并补回并行 sibling/result；端点缺失时宁可放弃 prune、返回完整旧历史，也不能静默少消息。",
    debugPath: "追 compact boundary metadata、recordTranscript UUID dedup、applyPreservedSegmentRelinks 验证、buildConversationChain parent 回溯和 DAG repair。",
    experiment: "保存 compact 前内存链、JSONL 行和 resume 链；分别运行完整端点与损坏端点，执行 checkResumeConsistency 并比较 tool 配对。",
    deliverable: "一张 write→load UUID 端点图、正常/损坏恢复 diff，以及并行工具 DAG 的节点清单。",
    reviewQuestion: "为什么 compact 的正确性必须验证退出再恢复，而不能只看内存结果？",
    reviewAnswer: "messagesToKeep 已经存在于 JSONL，UUID 去重不会重写旧 parent。内存看似连续并不保证磁盘链可恢复，必须靠 boundary metadata 与读侧 relink 完成逆过程。",
  },
  C08: {
    failureTrigger: "让 MCP server 首次调用返回 session expired，重连后成功；同时让 managed、session、marketplace、builtin 插件提供同名 command。",
    failureSymptom: "MCP 只重试一次并保持同一内部 Tool 合同；插件同名资源按 managed policy 与 session>marketplace>builtin 决定，来源和错误不能丢。",
    debugPath: "分两路追 fetchToolsForClient adapter/call recovery 与 pluginLoader create/merge sources，最后在 queryLoop 的 turn-boundary refresh 汇合。",
    experiment: "FakeMCP 暴露 annotations/schema 并模拟过期；创建四来源同名资源，记录最终 Tool flags、调用次数、获胜来源和下一 turn 工具表。",
    deliverable: "一张外部协议→内部 Tool 字段映射表，以及插件来源优先级和 MCP 重连事件序列。",
    reviewQuestion: "为什么 MCP 与插件都必须先适配成内部能力，再交给 queryLoop？",
    reviewAnswer: "loop 只应理解稳定 Tool/Command/Hook 协议。连接状态、session 重连、manifest 路径和来源策略属于边界层，否则每个外部生态都会污染核心状态机。",
  },

  O01: {
    failureTrigger: "给一次真实消息生成全链路 trace，并故意让 Channel、routing、Harness、core、delivery 各记录一个同名但不同含义的 status。",
    failureSymptom: "每个事实只能由一层首次确认并被下游携带；core 不应重新推断 peer，delivery 失败也不应把已完成的推理判成未执行。",
    debugPath: "按 runChannelTurn admission→route/session→Harness selection→runAttempt/agent-core→delivery settlement，给每段输入输出标 owner。",
    experiment: "用固定 trace id 跑一条成功和一条 delivery 失败消息，收集六层结构化事件；删除任一层字段，观察下游是否错误重算。",
    deliverable: "一张事实所有权矩阵和两条端到端 trace，明确第一个外部副作用与最终可见性判断。",
    reviewQuestion: "为什么 OpenClaw 的主链不能简化成 Channel→Agent→send？",
    reviewAnswer: "中间还有身份归属、session 隔离、Harness/runtime 选择和投递结算。省略这些层会把已确认事实重新塞回 Agent 猜测，也无法区分模型完成与用户真正收到。",
  },
  O02: {
    failureTrigger: "在并行工具批次运行时放入 steering，并在 Agent 本应结束时放入 follow-up；令一个尚未启动的 tail call 被 steering 跳过。",
    failureSymptom: "已启动工具安全完成，未启动调用得到配对 skipped result；steering 进入内层检查点，follow-up 只在内层退出后进入外层。",
    debugPath: "同时记录 Agent 两只 PendingMessageQueue、nested runLoop、tool execution arrays、ordered finalized calls 和 transcript result 顺序。",
    experiment: "三个工具设置不同启动 barrier，运行中注入 steering/follow-up；输出实际启动、完成、跳过、结果提交和下一 turn 的时间线。",
    deliverable: "一张双队列/双循环图和并行工具批次中 started/skipped/result 的配对表。",
    reviewQuestion: "为什么 steering 检查点必须保证每个 tool_use 都有结果？",
    reviewAnswer: "Provider transcript 要求调用与结果配对。若直接截断尚未执行的尾部调用，下一轮会看到悬空 tool_use；合成 skipped result 才能在改变方向时保持协议合法。",
  },
  O03: {
    failureTrigger: "同 session 启动 A 后再启动 B，不同 session 启动 C；让全局并发只有一，并连续触发可重试错误直到预算耗尽。",
    failureSymptom: "B 先等 session lane，C 可竞争 global lane；每次 run 持有同一 prepared snapshot；超过预算返回 blocked terminal 并完整释放 lease/MCP/context。",
    debugPath: "追 identity 回填、session/global lane admission、prepared runtime lease、run-loop retryKind/budget 和 finally cleanup。",
    experiment: "用 barrier 控制 A/B/C，FakeAttempt 前两次失败第三次成功，再测试超预算；记录 lane wait、lease identity、attempt 次数和资源计数。",
    deliverable: "一张三运行 lane 甘特图、一张 retry state table 和前后资源/lease 数量对照。",
    reviewQuestion: "为什么 session lane 必须在 global lane 之前？",
    reviewAnswer: "先串行同会话维护与运行，能避免同一 transcript 争用；随后才占全局稀缺额度。反过来会让等待同会话锁的请求白占全局并发槽。",
  },
  O04: {
    failureTrigger: "构造 dispatch 提前报错但平台已经接受 partial reply、finalization 又失败的组合，并模拟相同入站事件重试。",
    failureSymptom: "入站事实只记录一次；已可见 partial 的优先级高于早期 dispatch error，不能重复发送；deferred settlement 仍保留 finalization 错误。",
    debugPath: "记录 ingest/classify/preflight、route assembly、session record、dispatch result、provider receipt、pending delivery 和 lifecycle settle。",
    experiment: "FakeChannel 返回 accepted receipt 后抛 finalization error，重复调用同一 turn；比较 session entries、send count、visible result 与 retry decision。",
    deliverable: "一张 admission/dispatch/delivery 三状态乘积表，以及 partial accepted 场景的单次发送证据。",
    reviewQuestion: "为什么 Agent run 成功不能直接等价为一次 Channel Turn 成功？",
    reviewAnswer: "模型终态与外部平台投递是两个提交边界。平台可能已接受部分内容、回执延迟或结算失败；只有 delivery owner 能判断用户可见性和是否安全重试。",
  },
  O05: {
    failureTrigger: "配置 peer、parent、role、guild、account、channel 多层 binding，并用两个 direct peer 分别切换 main/per-peer/per-channel-peer dmScope。",
    failureSymptom: "匹配必须按固定 tier 首次命中并记录 matchedBy；session key 隔离随 dmScope 改变；畸形 agent: key 必须拒绝而不是回落默认 Agent。",
    debugPath: "打印 normalized BindingScope、索引候选、每个 tier 命中、agentId/dmScope 和 buildAgentPeerSessionKey 最终字符串。",
    experiment: "建立一组重叠 binding 测试表，对每个输入断言 matchedBy 与 sessionKey；再传 malformed key，确认 store guard fail closed。",
    deliverable: "一张 binding tier 决策表和四种 dmScope 下的会话隔离矩阵。",
    reviewQuestion: "为什么 session key 既不能由 prompt 推断，也不能当作授权令牌？",
    reviewAnswer: "它由已验证渠道身份和路由配置编码，用于历史隔离；知道或伪造字符串不等于拥有 transport 权限。授权必须继续依赖可信 session metadata 与 policy。",
  },
  O06: {
    failureTrigger: "运行 A 持有 generation 1 lease 时触发 config+auth refresh；在 replacement gate 开启时启动 B，并让新 owner 构建中途失败一次。",
    failureSymptom: "A 继续使用 gen1；B 等 gate，不能读半套 gen2；失败批次不发布部分 owner；重试成功后 B 才获得完整 gen2，A release 不删除 gen2。",
    debugPath: "追 stale 标记、pending replacement id/epoch、owner batch build、atomic publish、acquire identity check、leaseCount 与 release owner identity。",
    experiment: "给 build owner 加 barrier/failure injection，运行 A/B 并记录 snapshot object identity；在 A release 后检查 owners map 和 gen2 可见性。",
    deliverable: "两条 generation 时间线、gate 状态表和 release 前后 owner/leaseCount 快照。",
    reviewQuestion: "为什么 release 必须比较 owner 对象身份，不能只按同一个 key 删除？",
    reviewAnswer: "热更新后新旧 owner 可以共享逻辑 key。旧 run 释放时若只按 key 删除，会误删已经发布的新 generation；绑定对象身份才能只退休自己持有的版本。",
  },
  O07: {
    failureTrigger: "让某工具先被 sender policy 从目录移除；另一工具可见，但 plugin hook 重写最终参数为 schema 非法或需要 owner approval。",
    failureSymptom: "被目录过滤的工具从不出现在模型 schema；可见工具的每次调用仍经过 trusted policy、approval、hook、final owner approval 和最终 schema 校验。",
    debugPath: "保存 candidate tools、每个 named surface layer 的 exclusion provenance，以及 raw/prepared/policy/hook/final 参数和最终 outcome。",
    experiment: "为同一工具配置 group allow、sender deny，再反转；对获准调用让 hook 改参数，分别触发 blocked、requireApproval、schema failure 和成功。",
    deliverable: "一张工具目录过滤漏斗、一张单次调用参数版本 diff 和最终副作用计数。",
    reviewQuestion: "为什么只在 execute 前做一次 allow/deny 不足够？",
    reviewAnswer: "目录阶段决定模型是否应看见能力，调用阶段还要审查具体参数和动态身份；Hook/审批会改写参数，因此最终 shape 必须在真正副作用前再次校验。",
  },
  O08: {
    failureTrigger: "安装两个声明同一 Harness id 的插件；再选择一个显式但不支持当前 route 的 runtime，并与 runtime=auto 对照。",
    failureSymptom: "重复 id 必须报告已有 owner；显式 runtime 缺失/不支持/执行失败都 fail closed；只有 auto 无匹配时回到 built-in。",
    debugPath: "从 manifest required runtime→gateway startup plan→registerAgentHarness owner→active registry→selection explicit/auto→dispose on reload。",
    experiment: "构造两个最小 Harness 插件和三种 route support，运行 explicit、auto、duplicate id、reload 四组场景并记录 ownerPluginId 与最终选择。",
    deliverable: "一张 manifest 激活/registry owner/selection 结果表，以及显式与 auto 的失败语义对照。",
    reviewQuestion: "为什么显式选择插件 Harness 时不能在失败后静默回落 built-in？",
    reviewAnswer: "Harness 会改变线程、工具、模型协议和安全语义。用户显式选择意味着这些语义是必要条件；静默回落会产生看似成功但运行世界错误的结果。",
  },
};

const systemDesignGems: Record<ProjectKey, SignatureDesign[]> = {
  dsh: [
    { name: "Scope 拥有副作用", ordinary: "常见插件系统只负责 register，监听器、连接和缓存的清理要靠作者自觉。", choice: "Cordis 把 service、event listener 与 effect 都挂在 Context / Scope 生命周期下，安装与撤销成为同一协议。", payoff: "热重载、局部 Agent 与测试隔离不再依赖全局清场；插件能真正做到可插拔。", cost: "作者必须理解 scope 层级，错误挂载仍会造成能力泄漏或过早销毁。" },
    { name: "SessionEvent 是唯一事实", ordinary: "许多 Agent 同时维护 messages、UI 列表、日志和恢复快照，再用同步代码保持一致。", choice: "DSH 只追加 SessionEvent；模型消息、UI trajectory、fork 与 transcript 都从事件流投影。", payoff: "回放、审计和分支天然共享一份事实，新增视图不需要再发明一套存储。", cost: "投影逻辑和事件版本必须稳定，读代码时也要适应“状态来自重放”而非原地对象。" },
    { name: "Seam + Scope 换执行世界", ordinary: "换沙箱或文件系统时，往往给每个工具增加 backend 参数和 if 分支。", choice: "消费者依赖 seam，具体 provider 在 scope 中解析；局部 provider 可以 shadow 全局实现。", payoff: "一次替换能让整组工具进入新的模型、文件系统或运行环境，上层逻辑保持不变。", cost: "能力解析是间接的，排查问题必须同时查看 definition、provider 与当前 scope。" },
    { name: "Profile / Bundle / patch 组装产品", ordinary: "Web、CLI、Headless 各有入口文件，功能差异靠条件判断不断累积。", choice: "Profile 选择形态，Bundle 展开插件集合，patch 按稳定 id 覆盖具体节点。", payoff: "产品差异变成可打印、可比较的配置树，而不是散在代码里的隐藏分支。", cost: "组合顺序本身成为架构，需要稳定 id、冲突规则和清晰的配置诊断。" },
  ],
  pi: [
    { name: "Awaited listener 作为提交屏障", ordinary: "Agent 发事件后立即进入工具或下一轮，持久化与扩展在旁路异步追赶。", choice: "PI 先归约 Agent state，再按订阅顺序 await listener；AgentSession 的扩展通知与 JSONL append 都进入该屏障。", payoff: "工具 preflight、下一 turn 与 waitForIdle 不会读到半提交的产品状态。", cost: "慢 listener 会直接增加循环延迟，因此扩展必须理解自己位于关键路径。" },
    { name: "Provider 同时拥有目录、认证与流", ordinary: "全局 registry 分别管理 model list、API key 与 stream adapter，容易组合出不一致状态。", choice: "每个 Provider 自己实现 getModels/auth/stream，Models 只做代际 refresh、认证解析和按 id 委托；API adapter 可 lazy load。", payoff: "动态目录、短期凭据与协议实现保持同一所有权，上层只面对统一终止语义。", cost: "Provider 契约很宽，新增适配器必须同时处理目录、认证、错误和能力过滤。" },
    { name: "双队列直接映射两层循环", ordinary: "所有运行中输入都放进一个队列，在下一次请求前统一 drain。", choice: "steering 在完整 turn 与工具批次后进入内层；follow-up 只在 Agent 本应停止时由外层检查。", payoff: "用户介入时机是确定的控制流，不依赖 UI 猜测；one-at-a-time 只改变每次取几条。", cost: "steering 不会立即取消当前工具，产品必须向用户解释这不是硬中断。" },
    { name: "Leaf + compaction 投影 JSONL 树", ordinary: "会话文件按行顺序重放，分支时复制文件，压缩时覆盖旧消息。", choice: "条目以 parentId 组成树，leaf 选择活动路径；buildContextEntries 再用最新 compaction summary 替换模型可见前缀。", payoff: "所有分支和原始历史共存，模型仍只接收当前路径与受预算治理的视图。", cost: "恢复必须重建索引与路径；当前同步文件 I/O 和并发写入仍需外围约束。" },
  ],
  nanobot: [
    { name: "Checkpoint 把工具轮次变成可恢复事务", ordinary: "Agent 被 /stop 取消后只保存用户输入，已经完成的工具结果随 coroutine 消失。", choice: "Runner 在 awaiting_tools、tools_completed 和 final_response 边界回调；Loop 把 checkpoint 写入 session metadata，取消路径再物化部分上下文。", payoff: "长工具运行可中断而不必整轮重做，下一轮也不会面对只有 tool_call 没有 tool_result 的坏历史。", cost: "checkpoint、provider private state 与最终 save 有多份暂态表示，恢复逻辑必须严格去重。" },
    { name: "Context Governance 只改发送副本", ordinary: "为了适配模型窗口，直接 truncate session.messages，导致审计记录和 append boundary 同时变化。", choice: "Session 先投影 legal replay，ContextBuilder 组装来源，ContextGovernor 再复制修复 tool 协议、offload 大结果和 compact inflight。", payoff: "provider 兼容与 token 治理不会污染持久事实；失败也不会让 save_skip 指向错误位置。", cost: "同一轮存在 persisted、assembled、model 三种 messages，调试必须明确当前看到哪一种。" },
    { name: "Archive cursor 保留原始 Session", ordinary: "压缩时用一条摘要替换磁盘旧消息，省空间但失去恢复与审计。", choice: "摘要或 raw fallback 追加到 memory/history.jsonl，last_consolidated 只推进归档进度，Session 继续保存原消息并投影近期后缀。", payoff: "模型窗口、后台记忆和用户 transcript 可使用不同时间尺度，又不会因摘要失败静默丢历史。", cost: "Session 整文件重写会随消息数增长，长期磁盘治理仍需要独立策略。" },
    { name: "Dream 用最小权限 + 成功游标 + Git diff", ordinary: "后台模型读全部工作区，输出一段‘已经学习’文字后就把历史标为已处理。", choice: "Dream 只拿四类受限文件工具；clean completion 且无工具错误才推进 cursor；真实 worktree diff 决定是否和如何提交。", payoff: "失败批次可重试，记忆副作用可审计，模型自述不能伪造完成状态。", cost: "把 workspace 变成 Git-tracked memory store 增加运维概念，外部未提交改动也需要谨慎区分。" },
  ],
  claude: [
    { name: "两种产品壳共用一颗 loop", ordinary: "为了复用，把 REPL、SDK、ACP 的全部状态强行塞进一个万能 Session 类。", choice: "REPL 直接拥有 React/日志/队列状态，QueryEngine 拥有 headless/SDK 跨轮状态；二者只在 query() 汇合。", payoff: "共享模型—工具语义，又允许交互 UI 与协议 SDK 按不同节奏演进；源码调用关系也比概念图更诚实。", cost: "持久化和事件投影存在两套壳，修 loop 周边问题时必须验证两个消费者。" },
    { name: "并发可见，确定提交", ordinary: "并发工具谁先完成就谁先修改共享 context，性能好但结果依赖时序。", choice: "safe batch 的消息按完成时间 yield；contextModifier 按原 tool_use block 顺序排队提交，unsafe tool 逐个执行。", payoff: "用户及时看到进度，同时相同模型输出得到可复现的后续上下文。", cost: "执行层必须维护消息流与状态提交两套顺序，工具作者还要正确声明 input-dependent safety。" },
    { name: "权限是不可越级的决策格", ordinary: "插件 Hook 返回 allow 就视为最终授权，组织 deny 和用户 ask 容易被旁路。", choice: "Hook allow 仍经过 rule check；deny 覆盖、ask 继续弹窗，interactive/requireCanUseTool 也保持强制。", payoff: "扩展可以自动化常规审批，却不能悄悄获得比组织策略更高的权力。", cost: "输入会经历 raw、validated、backfilled、hook-updated 与 call 等多个版本，追错必须标清对象身份。" },
    { name: "Compact relink 设计 write→load 逆过程", ordinary: "内存里生成 summary + 最近消息后就认为压缩完成，resume 正确性留给运气。", choice: "boundary 保存 kept segment 的 head/anchor/tail；JSONL 保持 UUID 去重与追加，读侧验证后 relink，并修复并行工具 DAG。", payoff: "不重写旧事实也能恢复压缩后的模型视图；元数据坏时宁可回退完整历史而非静默丢消息。", cost: "transcript 不再是简单链表，恢复代码要处理多 boundary、保留段、并行 sibling 和一致性遥测。" },
  ],
  openclaw: [
    { name: "Channel Turn 是可结算事务", ordinary: "渠道回调直接 await Agent，再把 final text 发送；异常统一当失败重试。", choice: "ingest/admission、session record、Agent dispatch、provider delivery 与 deferred settlement 分层；partial visible result 的优先级高于早期 dispatch error。", payoff: "不会因回执迟到而重复发送，也不会让已记录入站事实随模型失败消失。", cost: "一次消息有多种 admission、dispatch 与 delivery 结果，适配器必须实现严格生命周期。" },
    { name: "双队列映射双循环", ordinary: "运行中输入都放同一队列，什么时候生效由外围 UI 猜。", choice: "steering 在内层工具循环的检查点进入；follow-up 只在 Agent 本应停止时由外层循环接管。", payoff: "介入时机是可测试控制流，并行工具仍能安全完成或产生 paired skipped result。", cost: "steering 不是硬中断；产品需要解释已启动工具与尚未启动 tail call 的不同命运。" },
    { name: "Generation gate + identity-safe lease", ordinary: "reload 原地修改全局 model/auth/plugin registry，再靠锁避免明显竞态。", choice: "先同步 stale 并打开 replacement gate，整批 owner 构建成功后原子发布；run lease 绑定 owner 对象身份。", payoff: "新请求从不读半套世代，旧 release 也不会误删同 key 的新 owner。", cost: "需要 epoch、gate、owner provenance、retention 和 leaseCount 等完整生命周期状态。" },
    { name: "工具安全分成目录与调用两道门", ordinary: "所有工具都暴露给模型，execute 前统一跑一次 allow/deny。", choice: "surface pipeline 按多层身份先裁剪目录；before_tool_call 再对 Hook/审批后的最终参数验证并 fail closed。", payoff: "模型不会反复调用不可用能力，参数重写也不能绕过 schema、owner approval 或 voice grant。", cost: "同一调用存在 raw、prepared、policy-adjusted、hook-adjusted 与 final 参数，诊断必须记录每次转换。" },
  ],
};

const glossaryRules: Array<{ match: RegExp; meaning: string }> = [
  { match: /session|history|jsonl|trajectory/i, meaning: "会话与历史记录：负责把已经发生的消息、工具结果和状态保存下来，方便恢复与回放。" },
  { match: /inbound|outbound|message|response/i, meaning: "系统里流动的一条标准消息。统一格式后，上下游就不必知道它最初来自哪个界面或模型。" },
  { match: /channel|websocket|delivery/i, meaning: "连接外部世界的入口或出口，负责收消息、做格式翻译，再把结果送回用户。" },
  { match: /bus|queue|inbox/i, meaning: "消息的中转站。生产者把任务放进去，消费者按顺序取走，从而避免模块直接绑死。" },
  { match: /memory|dream|soul|user/i, meaning: "比单轮对话更长期的信息，例如用户偏好、Agent 身份或从历史中提炼出的稳定事实。" },
  { match: /context|prompt|agents|skills/i, meaning: "模型在这一轮真正能看到的材料集合；它是按规则组装出来的视图，不等于全部存储内容。" },
  { match: /provider|model|llm|stream/i, meaning: "模型适配层与流式响应：把不同厂商的接口差异翻译成系统内部统一事件。" },
  { match: /tool|handler|schema|discovery/i, meaning: "Agent 可调用的外部能力。Schema 告诉模型怎么调用，Handler 负责真正执行。" },
  { match: /profile|bundle|patch|plugin|cordis|ctx/i, meaning: "可组合的功能模块或配置单元。系统通过安装、叠加和覆盖这些单元形成不同产品。" },
  { match: /turn|step|loop|runner|agent/i, meaning: "Agent 的执行边界：接收输入、请求模型、处理工具调用，并决定继续一轮还是结束。" },
  { match: /scope|seam|service/i, meaning: "能力的边界与作用范围，用来决定谁提供实现、谁能使用，以及什么时候回收。" },
  { match: /compact|summary|token|visibility/i, meaning: "上下文预算治理：决定保留什么、压缩什么，以及本轮哪些历史对模型可见。" },
  { match: /gateway|manager|cron|api|web/i, meaning: "产品外围的长期服务，负责启动、连接、定时任务和关闭，但不直接承担模型推理。" },
  { match: /final|result|future/i, meaning: "这条路径的输出。它可能直接展示给用户，也可能成为下一次循环的新输入。" },
];

function explainTerm(term: string) {
  return glossaryRules.find((rule) => rule.match.test(term))?.meaning
    ?? "流程中的一个职责节点。先观察它接收什么，再观察它把什么交给下一步，就能理解它的边界。";
}

function explainFlowStep(steps: string[], index: number) {
  const current = steps[index];
  const previous = steps[index - 1];
  const next = steps[index + 1];
  if (index === 0) return `请求从 ${current} 进入。这里先收集原始输入，并准备交给 ${next}。`;
  if (index === steps.length - 1) return `${current} 收拢前面各层的处理结果，形成用户或下一轮能够继续使用的输出。`;
  return `${current} 接过 ${previous} 的结果，只完成自己的职责，再把标准化后的结果交给 ${next}。`;
}

function traceInput(steps: string[], index: number) {
  if (index === 0) return "用户请求、外部事件或上层已经完成归一化的入口参数";
  return `${steps[index - 1]} 产出的结构化结果，以及当前会话 / 运行时上下文`;
}

function traceOutput(steps: string[], index: number) {
  if (index === steps.length - 1) return "可展示、可持久化，或能被下一轮继续消费的最终结果";
  return `交给 ${steps[index + 1]} 的标准对象、事件或可等待结果`;
}

function invariantExplanation(point: string, detail: LessonDetail) {
  if (/会话|历史|持久|记录|分支|真源/i.test(point)) return "它保证恢复、回放和 UI 不需要维护第二份互相同步的事实；一旦破坏，最先出现的是历史分叉与不可审计。";
  if (/工具|权限|策略|校验|沙箱/i.test(point)) return "它把模型意图与真实副作用隔开；一旦破坏，工具协议会退化成不可控制的函数直调。";
  if (/模型|provider|流|响应/i.test(point)) return "它把厂商差异封在传输边界；一旦破坏，Agent Loop 会被供应商字段和流式细节污染。";
  if (/上下文|预算|压缩|记忆/i.test(point)) return "它区分“已经保存”与“本轮可见”；一旦破坏，系统会在 token 超限、事实丢失和上下文串线之间摇摆。";
  if (/消息|队列|渠道|入口|路由/i.test(point)) return "它让外部入口只负责翻译和投递；一旦破坏，每增加一个渠道都要复制核心执行逻辑。";
  if (/插件|组合|替换|扩展|注册/i.test(point)) return "它让变化集中在稳定扩展面；一旦破坏，新增能力就只能修改中心模块并扩大回归范围。";
  if (/生命周期|启动|关闭|副作用|回收/i.test(point)) return "它确保资源的创建者也负责结束；一旦破坏，监听器、连接与后台任务会跨轮残留。";
  if (/顺序|串行|并发|批次|barrier|屏障/i.test(point)) return "它把“可以同时执行”和“必须确定提交”分开；一旦破坏，相同模型输出会因 I/O 完成时序不同而产生不同上下文。";
  if (/turn|step|steer|follow|inject|轮次|停止/i.test(point)) return "它规定新输入第一次可见的检查点；一旦破坏，用户介入会随机落入当前工具、下一步或下一轮。";
  if (/snapshot|generation|lease|代际|快照|准入|刷新/i.test(point)) return "它保证一次运行只读取一个完整世代；一旦破坏，热更新会让同一 turn 混用新旧模型、认证或插件状态。";
  if (/身份|session key|隔离|归属|owner|所有者/i.test(point)) return "它要求身份与状态只有一个权威来源；一旦破坏，下游会重新猜测归属，造成历史串线或旧 owner 误删新状态。";
  if (/失败|拒绝|fail|error|回落|fallback/i.test(point)) return "它把不满足前提的情况变成显式终态；一旦破坏，系统会以错误的执行器、权限或上下文继续，看似成功却不可解释。";
  if (/表面|投影|视图|可见/i.test(point)) return "它把 durable fact 与临时消费视图分开；一旦破坏，一次模型预算或 UI 选择就会反向改写历史原件。";
  if (/协议|配对|终止|artifact|结果/i.test(point)) return "它保证每个开始都有唯一、可回放的结束表示；一旦破坏，下一轮会遇到悬空调用、重复结果或无法判定的半终态。";
  if (/发现|清单|manifest|目录|激活/i.test(point)) return "它区分“知道能力存在”与“允许加载并执行能力”；一旦破坏，扫描插件或工具目录本身就会触发不受控代码。";
  const anchors = detail.evidence.slice(0, 2).map((item) => item.symbol).join(" 与 ");
  return `这条约束要同时在 ${anchors} 两侧成立：前者定义状态或决策，后者证明它怎样被消费；只看一侧还不能把“${point}”当成架构事实。`;
}

function Lecture({ lesson, project }: { lesson: Lesson; project: ProjectKey }) {
  const detail = lessonDetails[lesson.id];
  const drill = lessonDrills[lesson.id];
  const trace = detail.trace ?? lesson.flow.map((step, index) => ({
    name: step,
    input: traceInput(lesson.flow, index),
    responsibility: explainTerm(step),
    output: traceOutput(lesson.flow, index),
    anchor: index === 0 ? detail.evidence[0].symbol : index === lesson.flow.length - 1 ? detail.evidence.at(-1)?.symbol ?? step : `${lesson.flow[index - 1]} → ${step}`,
  }));
  const inferenceCount = detail.evidence.filter((item) => item.kind === "架构推断").length;

  return (
    <article className="lecture">
      <section id="start">
        <div className="section-number">01</div>
        <div className="section-wide">
          <h2>为什么“{lesson.points[0]}”值得单独设计</h2>
          <div className="editorial-intro">
            <p className="editorial-lead">{lesson.why}</p>
            <p>{detail.architecture}</p>
            <p className="plain-analogy"><b>换个直观说法。</b>{lesson.model}</p>
            <p className="editorial-judgment" style={{ borderColor: lesson.groupColor }}>{lesson.motto}</p>
          </div>
        </div>
      </section>
      <section id="flow">
        <div className="section-number">02</div>
        <div className="section-wide">
          <h2>从 {lesson.flow[0]} 到 {lesson.flow.at(-1)}，控制权怎样移动</h2>
          <p className="section-lead">从 <code>{lesson.flow[0]}</code> 到 <code>{lesson.flow.at(-1)}</code>，每个节点只完成一段工作。先看控制权如何移动，再决定哪些函数值得深入。</p>
          <FlowDiagram steps={lesson.flow} color={lesson.groupColor} />
          <details className="concept-sketch">
            <summary>展开等价伪代码：只用于理解控制流 <span>＋</span></summary>
            <pre aria-label={`${lesson.id} 教学示意代码`}><code>{lesson.code}</code></pre>
          </details>
        </div>
      </section>
      <section id="evidence">
        <div className="section-number">03</div>
        <div className="section-wide">
          <h2>沿着 {detail.evidence[0].symbol} 追下去</h2>
          <p className="section-lead">下面的链接固定在提交 <code>{projects[project].revision.slice(0, 12)}</code>。实现、测试和教程推断分开标注；代码没有证明的部分，不借术语补齐。</p>
          <div className="evidence-list">
            {detail.evidence.map((item, index) => (
              <article key={`${item.file}-${item.symbol}`}>
                <header>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <a href={repoSourceUrl(project, item.file, item.lineStart, item.lineEnd)} target="_blank" rel="noreferrer">
                    <strong>{item.symbol}</strong>
                    <code>{item.file}{item.lineStart ? ` · L${item.lineStart}${item.lineEnd ? `–${item.lineEnd}` : ""}` : ""}</code>
                  </a>
                  <small>{item.kind ?? "代码证据"} ↗</small>
                </header>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
          <h3 className="argument-subhead">把这些证据串成一条执行链</h3>
          <ol className="trace-story" aria-label={`${lesson.id} 调用链说明`}>
            {trace.map((step, index) => (
              <li key={`${step.name}-${index}`}>
                <header><span>{String(index + 1).padStart(2, "0")}</span><strong>{step.name}</strong><code>{step.anchor}</code></header>
                <p>{step.responsibility}</p>
                <p><b>输入：</b>{step.input}<br /><b>交出：</b>{step.output}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section id="invariants">
        <div className="section-number">04</div>
        <div className="section-wide">
          <h2>如果“{lesson.points[0]}”被破坏</h2>
          <div className="invariant-prose">
            {lesson.points.map((point, index) => (
              <article key={point}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{point}</h3><p>{invariantExplanation(point, detail)}</p></div></article>
            ))}
          </div>
        </div>
      </section>
      <section id="failure">
        <div className="section-number">05</div>
        <div className="section-wide">
          <h2>用一次失败检验“{lesson.points[1]}”</h2>
          <div className="failure-story">
            <p><b>先制造问题。</b>{drill.failureTrigger}</p>
            <p><b>再观察系统。</b>{drill.failureSymptom}</p>
            <p><b>如果现象不对。</b>{drill.debugPath}</p>
            <p><b>真正动手时。</b>{drill.experiment}</p>
            <p className="failure-deliverable"><b>最后应留下：</b>{drill.deliverable}</p>
          </div>
        </div>
      </section>
      <section id="review">
        <div className="section-number">06</div>
        <div className="section-wide">
          <h2>这条结论适用到哪里</h2>
          <p className="evidence-boundary">本课用了 {detail.evidence.length} 个源码位置，其中 {inferenceCount} 个明确标为架构推断。固定提交只能证明这一版实现；它不能证明所有 Agent 都应采用同一种结构。</p>
          <div className="review-questions">
            <details>
              <summary><span>Q1</span><strong>{drill.reviewQuestion}</strong><i>展开参考答案 ＋</i></summary>
              <p>{drill.reviewAnswer}</p>
            </details>
            <details>
              <summary><span>Q2</span><strong>哪两处代码一起证明了本课结论？</strong><i>展开参考答案 ＋</i></summary>
              <p><code>{detail.evidence[0].file}</code> 的 <code>{detail.evidence[0].symbol}</code> 给出第一侧边界；<code>{detail.evidence[1].file}</code> 的 <code>{detail.evidence[1].symbol}</code> 给出组装、消费或生命周期的另一侧。只引用其中一个还不足以证明完整调用关系。</p>
            </details>
          </div>
        </div>
      </section>
    </article>
  );
}

function FlowDiagram({ steps, color }: { steps: string[]; color: string }) {
  const stepKey = steps.join("→");
  const [activeStep, setActiveStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setActiveStep(0);
      setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [stepKey]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (activeStep >= steps.length - 1) setPlaying(false);
      else setActiveStep((current) => current + 1);
    }, 1350);
    return () => window.clearTimeout(timer);
  }, [activeStep, playing, steps.length]);

  const replay = () => {
    setActiveStep(0);
    setPlaying(true);
  };

  return (
    <div className="flow-player" style={{ "--flow-color": color } as CSSProperties}>
      <div className="flow-controls">
        <span>STEP {String(activeStep + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span>
        <div>
          <button type="button" onClick={() => setPlaying((current) => !current)}>{playing ? "暂停" : "继续"}</button>
          <button type="button" onClick={replay}>重播</button>
        </div>
      </div>
      <div className="flow-diagram" aria-label={`运行路径，当前步骤 ${activeStep + 1}：${steps[activeStep]}`}>
        {steps.map((step, index) => (
          <div className={`flow-fragment ${index < activeStep ? "done" : ""} ${index === activeStep ? "active" : ""}`} key={step}>
            <button type="button" className="flow-node" aria-current={index === activeStep ? "step" : undefined} onClick={() => { setActiveStep(index); setPlaying(false); }}>
              <small>{String(index + 1).padStart(2, "0")}</small><strong>{step}</strong><i />
            </button>
            {index < steps.length - 1 && <span className="flow-arrow">→</span>}
          </div>
        ))}
      </div>
      <div className="flow-caption" aria-live="polite"><span>当前发生</span><strong>{steps[activeStep]}</strong><p>{explainFlowStep(steps, activeStep)}</p></div>
    </div>
  );
}

function SourceMap({ lesson, project }: { lesson: Lesson; project: ProjectKey }) {
  return (
    <article className="source-map">
      <div className="source-intro"><span>SOURCE WALK</span><h2>从这 {lesson.files.length} 个位置开始追</h2><p>路径已经与当前课程所指向的源码仓库核对；示意代码用于突出控制流，不是逐字复制。</p></div>
      <div className="file-stack">
        {lesson.files.map((file, index) => (
          <a key={file} href={repoSourceUrl(project, file)} target="_blank" rel="noreferrer">
            <span>{String(index + 1).padStart(2, "0")}</span><code>{file}</code><b>↗</b>
          </a>
        ))}
      </div>
      <div className="code-window">
        <div className="code-title"><span><i /><i /><i /></span><b>{lesson.id.toLowerCase()}_control_flow</b><small>concept sketch</small></div>
        <pre><code>{lesson.code}</code></pre>
      </div>
      <div className="reading-order"><span>推荐顺序</span><p><b>定义</b> → 看它承诺什么</p><p><b>组装</b> → 看谁创建它</p><p><b>消费</b> → 看结果流向哪里</p></div>
    </article>
  );
}

function Compare({ navigate }: { navigate: (route: RouteKey) => void }) {
  const headers: Array<{ key: ProjectKey; name: string; subtitle: string }> = [
    { key: "dsh", name: "DSH", subtitle: "Composable Harness" },
    { key: "pi", name: "PI Agent", subtitle: "Minimal & Extensible" },
    { key: "nanobot", name: "nanobot", subtitle: "Readable Application" },
    { key: "claude", name: "Claude 复原版", subtitle: "Reconstructed Coding Agent" },
    { key: "openclaw", name: "OpenClaw", subtitle: "Personal Agent OS" },
  ];
  const rows = [
    ["核心组织方式", "Cordis 插件树 + ctx", "四层包 + 极简核心", "分层 Python 模块 + 注册表", "REPL / QueryEngine 双壳 + queryLoop", "Gateway + Harness + Runner + Core"],
    ["消息入口", "Agent inbox + typed events", "AgentSession + 双消息队列", "异步 MessageBus", "REPL / QueryEngine 双外壳 → query()", "Channel → Gateway → Routing"],
    ["Agent 执行", "agent-loop 插件 + turn/step", "Agent core + 事件流", "AgentLoop / AgentRunner 分工", "queryLoop + provider stream + tool results", "Embedded Runner attempt loop"],
    ["状态真源", "append-only SessionEvent", "JSONL tree + active leaf", "Session 历史 + 长期 Memory", "JSONL transcript + compact boundary", "Sessions 持久化 + session key"],
    ["扩展工具", "ctx.tools + waterfall 管线", "ExtensionAPI + tool hooks", "ToolRegistry / plugin entry points", "Tool pool + permission + Hook + MCP", "agent-tools policy + plugin SDK"],
    ["模型替换", "ctx.llm seam provider", "pi-ai provider stream", "Provider 接口与 registry", "provider registry + stream adapter", "Prepared model runtime generation"],
    ["产品组装", "Profile / Bundle / patch", "ResourceLoader + CLI / SDK / RPC", "Gateway 作为 composition root", "Commander + React Ink + plugins", "Gateway 控制面 + Harness registry"],
    ["最强教学价值", "高度可组合、边界极致显式", "最小内核、工作流完全可塑", "清晰、直接、容易追调用链", "追通大型 Coding Agent 的完整产品栈", "理解生产级个人 Agent 的完整控制平面"],
  ];
  return (
    <main className="compare-page">
      <div className="compare-hero">
        <div className="eyebrow"><span /> SIDE BY SIDE · 横向对照</div>
        <h1>同一个 Agent 问题，<br /><em>五种系统答案。</em></h1>
        <p>从 DSH 的插件树、PI 的极简核心、nanobot 的清晰分层，到 Claude Code 复原版的完整 Coding 产品栈与 OpenClaw 的控制平面：它们不是强弱排序，而是五种复杂度预算。</p>
      </div>
      <div className="comparison-table">
        <div className="comparison-head">
          <span>架构问题</span>
          {headers.map((header) => <button key={header.key} onClick={() => navigate(header.key)}><b>{header.name}</b><small>{header.subtitle}</small></button>)}
        </div>
        {rows.map((row, index) => <div className="comparison-row" key={row[0]}><span><small>{String(index + 1).padStart(2, "0")}</small>{row[0]}</span>{row.slice(1).map((cell, cellIndex) => <p key={`${row[0]}-${headers[cellIndex].key}`}>{cell}</p>)}</div>)}
      </div>
      <section className="choice-section">
        <div><span>如果你更关心</span><h2>如何构建可换骨架的 Harness</h2><p>先读 DSH。它把插件生命周期、事件溯源、能力 seam 与产品组合都变成一等架构概念。</p><button onClick={() => navigate("dsh")}>进入 DSH 路线 →</button></div>
        <div><span>如果你更关心</span><h2>如何把工作流选择权交给用户</h2><p>先读 PI。它用极小 Agent core、会话树和统一扩展 API，展示“少内置、多可塑”的 Coding Harness。</p><button onClick={() => navigate("pi")}>进入 PI Agent 路线 →</button></div>
        <div><span>如果你更关心</span><h2>从一个能跑的个人 Agent 学起</h2><p>先读 nanobot。调用链短，Python 模块边界直接，消息、上下文、工具和记忆都能很快找到落点。</p><button onClick={() => navigate("nanobot")}>进入 nanobot 路线 →</button></div>
        <div><span>如果你更关心</span><h2>大型 Coding Agent 怎样从循环长成产品</h2><p>读 Claude Code 第三方复原版。沿 CLI、QueryEngine、queryLoop、工具权限、上下文、Transcript 与 React Ink 追完整调用链。</p><button onClick={() => navigate("claude")}>进入 Claude Code 路线 →</button></div>
        <div><span>如果你更关心</span><h2>个人 Agent 如何长成生产级系统</h2><p>读 OpenClaw。Gateway、路由、Harness、Runner、prepared runtime 和插件契约会拼成一张完整系统地图。</p><button onClick={() => navigate("openclaw")}>进入 OpenClaw 路线 →</button></div>
      </section>
      <section className="final-thesis"><small>THE THESIS</small><blockquote>DSH 换骨架；PI 交工作流；nanobot 做分层；Claude 复原版串起<em>产品全栈</em>；OpenClaw 搭起<em>控制平面</em>。</blockquote></section>
    </main>
  );
}
