#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
dock_tool.py — 给任意 Wallpaper Engine「场景类」壁纸一键添加 Launcher Dock 底栏。

用法:
    python dock_tool.py <壁纸项目目录> [--from <已有Dock壁纸>] [--out <输出目录名>] [--we <WE安装目录>]

    python dock_tool.py "E:\steam\steamapps\workshop\content\431960\xxxxxxxx"
    python dock_tool.py "E:\steam\steamapps\workshop\content\431960\xxxxxxxx" --from "艾莉丝 黄昏 Dock版"

说明:
    * 目标壁纸可以是散装工程(含 scene.json)或 scene.pkg 打包工程, 输出一律为
      散装工程, 安装到 Wallpaper Engine 的 myprojects 下, 目录名 = 原标题 + "_Dock"
      (--out 可覆盖)。
    * --from: 从已有 Dock 壁纸导入你在 WE 里调好的设置(快捷方式 s01c-s32c、
      图标数、大小、颜色等), 新壁纸开箱即用, 不用重新配一遍。
      源可以是 myprojects 里的目录名、壁纸标题或完整路径。
    * 只合并 Dock 子树真正引用的设置项; 源壁纸里日历/媒体等其他模块的设置
      (如 日历 Calendar)不会带进来。
    * openUserShortcut 带 isbound 门控: 未绑定快捷方式的图标点击只弹跳不启动,
      避免引擎同步解析空快捷方式造成的 ~1 秒冻结。
    * video / web 等非 scene 类型壁纸不支持(它们没有 scene.json)。

便携使用:
    整个工具文件夹(含 dock_source\ 资源缓存)拷到任何电脑都能用:
    自动通过注册表/Steam 库文件探测 Wallpaper Engine 安装位置;
    找不到时用 --we 参数手动指定。Dock 功能不要求订阅源壁纸。
"""
import json, os, re, shutil, struct, sys

# ---- 固定路径 ---------------------------------------------------------------
TOOL_DIR      = os.path.dirname(os.path.abspath(__file__))
DOCK_CACHE    = os.path.join(TOOL_DIR, 'dock_source')     # Dock 资源缓存(随工具携带, 无需订阅源壁纸)
DOCK_ROOT_NAME = 'Launcher Dock'
BOTTOM_MARGIN  = 150          # 底栏默认停靠位置: 底边向上留白(像素)
BUILT_IN_PREFIXES = ('models/util/', 'materials/util/', 'fonts/system')

WE_ROOT = None     # 运行时探测
WE_PROJECTS = None
WE_CONFIG = None

def find_we_root(explicit=None):
    """自动探测 Wallpaper Engine 安装目录(注册表 SteamPath + libraryfolders.vdf + 常见路径)。"""
    if explicit:
        if os.path.isdir(explicit):
            return explicit
        print(f'警告: --we 指定的目录不存在: {explicit}')
    cands = []
    try:
        import winreg
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'SOFTWARE\Valve\Steam')
        steam, _ = winreg.QueryValueEx(k, 'SteamPath')
        cands.append(steam)
    except Exception:
        pass
    for p in (r'C:\Program Files (x86)\Steam', r'C:\Program Files\Steam',
              r'D:\Steam', r'E:\Steam', r'D:\steam', r'E:\steam'):
        if os.path.isdir(p):
            cands.append(p)
    libs = []
    for s in cands:
        vdf = os.path.join(s, 'steamapps', 'libraryfolders.vdf')
        if os.path.isfile(vdf):
            try:
                txt = open(vdf, encoding='utf-8', errors='replace').read()
                for m in re.finditer(r'"path"\s*:\s*"([^"]+)"', txt):
                    libs.append(m.group(1).replace('\\\\', '\\'))
            except Exception:
                pass
        libs.append(s)
    seen = set()
    for lib in libs:
        lib = lib.rstrip('\\')
        if lib.lower() in seen: continue
        seen.add(lib.lower())
        root = os.path.join(lib, 'steamapps', 'common', 'wallpaper_engine')
        if os.path.isdir(root):
            return root
    return None

def init_we_paths(explicit=None):
    global WE_ROOT, WE_PROJECTS, WE_CONFIG
    WE_ROOT = find_we_root(explicit)
    if not WE_ROOT:
        print('错误: 找不到 Wallpaper Engine 安装目录。')
        print('请用 --we 参数指定, 例如:  python dock_tool.py <壁纸目录> --we "C:\\Program Files (x86)\\Steam\\steamapps\\common\\wallpaper_engine"')
        sys.exit(1)
    WE_PROJECTS = os.path.join(WE_ROOT, 'projects', 'myprojects')
    WE_CONFIG   = os.path.join(WE_ROOT, 'config.json')
    os.makedirs(WE_PROJECTS, exist_ok=True)
    print(f'Wallpaper Engine: {WE_ROOT}')

# ---- PKGV 包解包 ------------------------------------------------------------
def read_pkg(path):
    data = open(path, 'rb').read()
    idx = data.find(b'PKGV')
    if idx < 0:
        print('错误: 不是有效的 scene.pkg (找不到 PKGV 标记):', path); sys.exit(1)
    pos = idx + 8
    count = struct.unpack_from('<I', data, pos)[0]; pos += 4
    entries = []
    for _ in range(count):
        (pathlen,) = struct.unpack_from('<I', data, pos); pos += 4
        name = data[pos:pos+pathlen].decode('utf-8'); pos += pathlen
        off, size = struct.unpack_from('<II', data, pos); pos += 8
        entries.append((name, off, size))
    base = pos
    return {name: data[base+off:base+off+size] for name, off, size in entries}

def ensure_dock_cache():
    """Dock 源资源随工具自带(dock_source); 若缺失但有本地源壁纸包则现场解包。"""
    if os.path.exists(os.path.join(DOCK_CACHE, 'scene.json')) \
       and os.path.exists(os.path.join(DOCK_CACHE, 'project.json')):
        return
    pkg = os.path.join(TOOL_DIR, 'dock_source_pkg', 'scene.pkg')
    if not os.path.exists(pkg):
        print('错误: 缺少 dock_source 文件夹(scene.json/project.json/资源)。')
        print('请把工具目录里的 dock_source 一起复制 —— 它是 Dock 功能的全部来源。')
        sys.exit(1)
    files = read_pkg(pkg)
    for name, blob in files.items():
        dst = os.path.join(DOCK_CACHE, name.replace('/', os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, 'wb') as f:
            f.write(blob)
    print(f'Dock 资源已缓存 -> {DOCK_CACHE} ({len(files)} 个文件)')

# ---- 遍历工具 ---------------------------------------------------------------
def walk(objs):
    for o in objs:
        yield o
        yield from walk(o.get('objects', []))

def deep_iter(x):
    if isinstance(x, dict):
        yield x
        for v in x.values(): yield from deep_iter(v)
    elif isinstance(x, list):
        for v in x: yield from deep_iter(v)

# ---- 目标工程读取 -----------------------------------------------------------
def load_target(target_dir):
    pj_path = os.path.join(target_dir, 'project.json')
    if not os.path.exists(pj_path):
        print('错误: 目录里没有 project.json:', target_dir); sys.exit(1)
    pj = json.load(open(pj_path, encoding='utf-8'))
    if pj.get('type') != 'scene':
        print(f"错误: 「{pj.get('title')}」是 {pj.get('type')} 类型壁纸, 没有 scene.json, 无法加 Dock。")
        sys.exit(1)
    files = {}
    for root, _, fs in os.walk(target_dir):
        for f in fs:
            p = os.path.join(root, f)
            files[os.path.relpath(p, target_dir).replace(os.sep, '/')] = p
    scene_name = pj.get('file', 'scene.json')
    if scene_name in files:
        scene = json.load(open(files[scene_name], encoding='utf-8'))
    elif 'scene.pkg' in files:
        pkg = read_pkg(files['scene.pkg'])
        scene = json.loads(pkg['scene.json'].decode('utf-8'))
        files.pop('scene.pkg', None)
        tmp = os.path.join(TOOL_DIR, '_tmp_target')
        for name, blob in pkg.items():
            if name == 'scene.json':
                continue
            dst = os.path.join(tmp, name.replace('/', os.sep))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, 'wb') as f:
                f.write(blob)
            files[name] = dst
    else:
        print('错误: 找不到 scene.json 或 scene.pkg'); sys.exit(1)
    return pj, scene, files

# ---- Dock 子树提取 ----------------------------------------------------------
def extract_dock_subtree():
    scene = json.load(open(os.path.join(DOCK_CACHE, 'scene.json'), encoding='utf-8'))
    allo = list(walk(scene['objects']))
    root = next((o for o in allo if o.get('name') == DOCK_ROOT_NAME), None)
    if root is None:
        print('错误: Dock 源里找不到', DOCK_ROOT_NAME); sys.exit(1)
    sub, order = set(), []
    def collect(oid):
        if oid in sub: return
        sub.add(oid)
        order.append(oid)
        for c in allo:
            if c.get('parent') == oid: collect(c['id'])
    collect(root['id'])
    root_order = [o['id'] for o in scene['objects']]
    objs = sorted((o for o in allo if o['id'] in sub), key=lambda o: root_order.index(o['id']))
    for o in objs:
        o.pop('objects', None)   # 层级靠 parent 引用, 拍平追加
    return objs

# ---- 补丁(源脚本文本固定, 锚点稳定) -----------------------------------------
LAUNCH_APPLY = """
// fix: only launch when the user actually bound a shortcut (isbound).
let pendingShortcutBound = null;

export function applyUserProperties(userProperties) {
\tconst key = scriptProperties.newText;
\tif (key && userProperties.hasOwnProperty(key)) {
\t\tconst prop = userProperties[key];
\t\tif (prop && typeof prop.isbound === 'boolean') {
\t\t\tpendingShortcutBound = prop.isbound;
\t\t\tif (launcherState) {
\t\t\t\tlauncherState.shortcutBound = pendingShortcutBound;
\t\t\t}
\t\t}
\t}
}
"""

def apply_patches(objs):
    n_bg = n_lc = 0
    for o in objs:
        if o.get('name') == 'Background | Logic':
            s = o['visible']['script']
            s, n = re.subn(r"if \(state\.formattedName && state\.formattedName\.trim\(\) !== ''\) \{(\s*)engine\.openUserShortcut\(state\.formattedName\);",
                           "if (state.shortcutBound === true && state.formattedName && state.formattedName.trim() !== '') {\\1engine.openUserShortcut(state.formattedName);", s)
            assert n == 1, 'openUserShortcut 锚点未命中'
            o['visible']['script'] = s; n_bg += 1
        elif re.match(r'^Launcher \d+$', o.get('name', '')):
            s = o['scale']['script']
            anchor = 'launcherState = shared.initLauncher(thisLayer, value);'
            assert s.count(anchor) == 1
            s = s.replace(anchor, anchor + '\n\tlauncherState.shortcutBound = (pendingShortcutBound === true);')
            o['scale']['script'] = s + LAUNCH_APPLY; n_lc += 1
        elif o.get('name') == 'Drag and Drop':
            s = o['origin']['script']
            old = "export function cursorUp(event) {\n    isDragging = false;\n    localStorage.set(STORAGE_KEY, parent.origin);\n}"
            new = "export function cursorUp(event) {\n    if (isDragging) {\n        localStorage.set(STORAGE_KEY, parent.origin);\n    }\n    isDragging = false;\n}"
            assert old in s, 'Drag and Drop cursorUp 锚点未命中'
            o['origin']['script'] = s.replace(old, new)
    print(f'补丁: 底栏逻辑 x{n_bg}, 启动器 x{n_lc}, 拖拽层守卫')

# ---- 依赖闭包 ---------------------------------------------------------------
def collect_deps(objs, dock_files):
    needed, unresolved = set(), set()
    def resolve(s):
        for c in (s, s+'.json', s+'.tex', s+'.vert', s+'.frag',
                  'materials/'+s+'.json', 'materials/'+s+'.tex',
                  'materials/'+s, 'models/'+s+'.json'):
            if c in dock_files:
                return c
        return None
    def check(s):
        if re.match(r'^(effects|models|materials|shaders|particles|fonts)/', s):
            r = resolve(s)
            if r: needed.add(r)
            elif not s.startswith(BUILT_IN_PREFIXES): unresolved.add(s)
        elif re.match(r'^workshop/\d+/', s):
            r = resolve(s)
            (needed if r else unresolved).add(r or s)
        elif '/' not in s and not re.match(r'^[0-9.eE +-]*$', s) and len(s) > 3:
            r = resolve(s)
            if r: needed.add(r)
    def scan_json(o):
        if isinstance(o, str):
            check(o)
            for m in re.finditer(r'[\'"]((?:effects|models|materials|shaders|particles|fonts)/[^\'"\\]+)[\'"]', o):
                check(m.group(1))
        elif isinstance(o, dict):
            for v in o.values(): scan_json(v)
        elif isinstance(o, list):
            for v in o: scan_json(v)
    scan_json(objs)
    seen, queue = set(), [f for f in needed if f.endswith('.json')]
    while queue:
        f = queue.pop()
        if f in seen or f not in dock_files: continue
        seen.add(f)
        try:
            scan_json(json.loads(dock_files[f].decode('utf-8')))
        except (UnicodeDecodeError, json.JSONDecodeError):
            pass
    if unresolved:
        print('警告: 以下引用未解析(可能为引擎内置):', sorted(unresolved))
    return needed

# ---- 设置项合并(只保留 Dock 子树引用的) ---------------------------------------
def dock_seed_names(objs):
    blob = json.dumps(objs, ensure_ascii=False)
    seeds = set(re.findall(r'"user"\s*:\s*"([^"]+)"', blob))
    seeds |= set(re.findall(r'"name"\s*:\s*"(s\d+[a-z]|sappdock|siocnum|snewproperty\d*|newproperty\d*)"', blob))
    for m in re.finditer(r'"usertextures"\s*:\s*\[([^\]]*)\]', blob):
        seeds |= set(re.findall(r'"(s\d+[a-z])"', m.group(1)))
    return seeds

def merge_properties(dock_proj_path, objs, target_props):
    dprops = json.load(open(dock_proj_path, encoding='utf-8'))['general']['properties']
    seeds = dock_seed_names(objs)
    selected, queue = {}, [n for n in seeds if n in dprops]
    while queue:
        n = queue.pop()
        if n in selected: continue
        selected[n] = dprops[n]
        for m in re.finditer(r'([a-zA-Z_]\w*)\.value', json.dumps(dprops[n], ensure_ascii=False)):
            if m.group(1) in dprops and m.group(1) not in selected:
                queue.append(m.group(1))

    # 剔除非 Dock 引用的设置项(日历/媒体等被条件链拖进来的), 并修正显示条件
    dropped = set(selected) - seeds
    for n in dropped: del selected[n]
    fixed = 0
    for p in selected.values():
        cond = p.get('condition')
        if not cond: continue
        bad = [m for m in re.findall(r'([a-zA-Z_]\w*)\.value', cond) if m in dropped]
        if not bad: continue
        parts = [pt.strip() for pt in re.split(r'\s*&&\s*', cond)
                 if not any(re.search(r'\b%s\.value\b' % re.escape(b), pt) for b in bad)]
        parts = [pt for pt in parts if pt]
        if parts:
            p['condition'] = ' && '.join(parts)
        else:
            p.pop('condition', None)
        fixed += 1
    overlap = set(target_props) & set(selected)
    for k in overlap: selected.pop(k)
    target_props.update(selected)
    print(f'设置项: 合并 {len(selected)} 个'
          + (f', 剔除非Dock引用 {len(dropped)} 个 {sorted(dropped)}' if dropped else '')
          + (f', 修正条件 {fixed} 处' if fixed else '')
          + (f', 跳过同名冲突 {sorted(overlap)}' if overlap else ''))

# ---- 从已有 Dock 壁纸导入用户设置 ---------------------------------------------
def resolve_source(arg):
    if os.path.isdir(arg):
        return arg
    cand = os.path.join(WE_PROJECTS, arg)
    if os.path.isdir(cand):
        return cand
    for entry in os.listdir(WE_PROJECTS):        # 按壁纸标题匹配
        pjp = os.path.join(WE_PROJECTS, entry, 'project.json')
        try:
            t = json.load(open(pjp, encoding='utf-8')).get('title')
        except Exception:
            continue
        if t == arg:
            return os.path.join(WE_PROJECTS, entry)
    return None

def import_user_settings(source_arg, pj_props):
    """把源壁纸当前生效的 Dock 设置（工程默认值 + WE 面板覆盖）烘焙进新工程。"""
    src = resolve_source(source_arg)
    if not src:
        print(f'警告: 找不到源壁纸「{source_arg}」, 跳过设置导入'); return
    src_pj = os.path.join(src, 'project.json')
    if not os.path.isfile(src_pj):
        print(f'警告: 源壁纸没有 project.json, 跳过设置导入'); return
    try:
        base = json.load(open(src_pj, encoding='utf-8'))['general']['properties']
    except Exception as e:
        print('警告: 读取源 project.json 失败, 跳过设置导入:', e); return

    overrides = {}
    if os.path.exists(WE_CONFIG):
        try:
            key = os.path.abspath(os.path.join(src, 'scene.json')).replace('\\', '/')
            def norm(p):
                return os.path.normcase(os.path.normpath(p)).replace('\\', '/')
            cfg = json.load(open(WE_CONFIG, encoding='utf-8'))
            for v in cfg.values():
                if isinstance(v, dict) and 'wproperties' in v:
                    for k, mons in v['wproperties'].items():
                        if norm(k) == norm(key):
                            for mon in mons.values():
                                if isinstance(mon, dict):
                                    overrides.update(mon)
        except Exception as e:
            print('警告: 读取 config.json 失败(仅用工程默认值):', e)

    applied = []
    for name, val in overrides.items():          # 面板覆盖优先
        p = pj_props.get(name)
        if p is not None and json.dumps(p.get('value'), sort_keys=True) != json.dumps(val, sort_keys=True):
            p['value'] = val
            applied.append(name)
    for name, sp in base.items():                # 再补源工程的烘焙/默认值
        if name in overrides or name not in pj_props or 'value' not in sp:
            continue
        p = pj_props[name]
        if json.dumps(p.get('value'), sort_keys=True) != json.dumps(sp['value'], sort_keys=True):
            p['value'] = sp['value']
            applied.append(name)
    print(f'设置导入: 自「{os.path.basename(src)}」应用 {len(applied)} 项'
          + (f': {sorted(applied)}' if 0 < len(applied) <= 15 else ''))

# ---- 主流程 -----------------------------------------------------------------
def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); sys.exit(1)
    target_dir = args[0].strip('"')
    opt_from, opt_out, opt_we = None, None, None
    i = 1
    while i < len(args):
        if args[i] == '--from' and i + 1 < len(args): opt_from = args[i+1]; i += 2
        elif args[i] == '--out' and i + 1 < len(args): opt_out = args[i+1]; i += 2
        elif args[i] == '--we' and i + 1 < len(args): opt_we = args[i+1]; i += 2
        else: i += 1

    init_we_paths(opt_we)
    ensure_dock_cache()
    pj, scene, target_files = load_target(target_dir)
    title = pj.get('title', os.path.basename(target_dir))
    if any(o.get('name') == DOCK_ROOT_NAME for o in walk(scene['objects'])):
        print(f'「{title}」已经有 Dock 了, 不重复添加。'); sys.exit(1)

    # Dock 子树 + 深度重编 ID (对象/特效/通道/实例, 同一偏移保持内部引用一致)
    dock_files = {}
    for root, _, fs in os.walk(DOCK_CACHE):
        for f in fs:
            p = os.path.join(root, f)
            dock_files[os.path.relpath(p, DOCK_CACHE).replace(os.sep, '/')] = open(p, 'rb').read()
    objs = extract_dock_subtree()
    used = [n['id'] for n in deep_iter(scene) if isinstance(n.get('id'), int)]
    offset = (max(used) + 1) if used else 0
    for node in deep_iter(objs):
        if isinstance(node.get('id'), int): node['id'] += offset
        if isinstance(node.get('parent'), int): node['parent'] += offset

    proj = scene.get('general', {}).get('orthogonalprojection', {})
    W, H = int(proj.get('width', 1920)), int(proj.get('height', 1080))

    # WE 对纵横比不匹配的壁纸做铺满裁切: 竖版画布在横屏上只显示中部一条,
    # Dock 必须放在"可见区域"的底部, 否则会被裁掉。按主显示器分辨率计算。
    mon_w, mon_h = 1920, 1080
    try:
        import ctypes
        user32 = ctypes.windll.user32
        mw, mh = user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
        if mw > 0 and mh > 0:
            mon_w, mon_h = mw, mh
    except Exception:
        pass
    mon_aspect, canvas_aspect = mon_w / mon_h, W / H
    if canvas_aspect > mon_aspect:          # 画布更宽: 左右裁切, 全高可见
        vis_x0, vis_x1 = (W - H * mon_aspect) / 2, (W + H * mon_aspect) / 2
        vis_y0, vis_y1 = 0, H
    else:                                   # 画布更高: 上下裁切, 全宽可见
        vis_x0, vis_x1 = 0, W
        bh = W / mon_aspect
        vis_y0, vis_y1 = (H - bh) / 2, (H + bh) / 2
    root = next(o for o in objs if o.get('name') == DOCK_ROOT_NAME)
    root['origin'] = f'{(vis_x0+vis_x1)/2:.5f} {vis_y1-BOTTOM_MARGIN:.5f} 0.00000'
    print(f'画布 {W}x{H}, 显示器 {mon_w}x{mon_h}, 可见区 y[{vis_y0:.0f},{vis_y1:.0f}], '
          f'Dock 停靠: ({(vis_x0+vis_x1)/2:.0f}, {vis_y1-BOTTOM_MARGIN:.0f})')

    apply_patches(objs)
    needed = collect_deps(objs, dock_files)
    merge_properties(os.path.join(DOCK_CACHE, 'project.json'), objs, pj['general']['properties'])
    if opt_from is None:      # 未显式指定时, 读取工具目录里的 设置来源.txt
        hint = os.path.join(TOOL_DIR, '设置来源.txt')
        if os.path.isfile(hint):
            t = open(hint, encoding='utf-8-sig').read().strip()
            if t:
                opt_from = t
    if opt_from:
        import_user_settings(opt_from, pj['general']['properties'])
    scene['objects'].extend(objs)

    # 输出工程
    out_name = opt_out or re.sub(r'[\\/:*?"<>|]', '', f'{title}_Dock').strip()
    out = os.path.join(WE_PROJECTS, out_name)
    if os.path.exists(out):
        try:
            shutil.rmtree(out)
            os.makedirs(out, exist_ok=True)
            for rel, src in target_files.items():
                if not os.path.isfile(src): continue
                dst = os.path.join(out, rel.replace('/', os.sep))
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)
            for rel in sorted(needed):
                dst = os.path.join(out, rel.replace('/', os.sep))
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst, 'wb') as f:
                    f.write(dock_files[rel])
        except PermissionError:      # WE 正在运行该壁纸时文件被锁定: 同步覆盖
            import filecmp
            items = list(target_files.items())
            items += [(rel, os.path.join(DOCK_CACHE, rel.replace('/', os.sep))) for rel in sorted(needed)]
            for rel, src in items:
                if not os.path.isfile(src): continue
                dst = os.path.join(out, rel.replace('/', os.sep))
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                try:
                    shutil.copy2(src, dst)
                except PermissionError:
                    if not (os.path.exists(dst) and filecmp.cmp(src, dst, shallow=False)):
                        raise
            print('(目标正被占用, 已同步覆盖未锁定文件)')
    else:
        os.makedirs(out, exist_ok=True)
        for rel, src in target_files.items():
            if not os.path.isfile(src): continue
            dst = os.path.join(out, rel.replace('/', os.sep))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
        for rel in sorted(needed):
            dst = os.path.join(out, rel.replace('/', os.sep))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, 'wb') as f:
                f.write(dock_files[rel])
    json.dump(scene, open(os.path.join(out, 'scene.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent='\t')
    pj['title'] = f'{title} Dock版'
    pj['file'] = 'scene.json'
    pj.pop('workshopid', None); pj.pop('workshopurl', None)
    for pv in ('preview.jpg', 'preview.gif', 'preview.png'):
        if pv in target_files: pj['preview'] = pv
    json.dump(pj, open(os.path.join(out, 'project.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent='\t')

    total = sum(len(fs) for _, _, fs in os.walk(out))
    shutil.rmtree(os.path.join(TOOL_DIR, '_tmp_target'), ignore_errors=True)
    print(f'完成 -> {out}  (共 {total} 个文件)')
    print('打开 Wallpaper Engine 即可在「已安装」列表看到它。')

if __name__ == '__main__':
    main()
