# 轻途AI - 一键生成旅行攻略

> 告别小红书手动做功，AI一键生成可直接照着走的旅行攻略

## 项目简介

轻途AI是一款纯免费、零认证、无社交的轻量化AI旅行Web工具。基于苹果极简iOS设计风格，只做核心刚需功能，彻底摒弃传统旅行APP臃肿冗余问题。

### 核心痛点解决
1. ✅ 无需手动刷小红书整理旅行攻略
2. ✅ 解决旅行照片占用手机内存问题

### 技术栈
- **前端框架**: Next.js 15 + App Router + TypeScript + Tailwind CSS
- **后端BaaS**: Supabase 免费版（数据库+5G对象存储+Edge Function）
- **地图服务**: 高德地图JS API 个人免费版
- **AI服务**: 豆包大模型API + 豆包免费联网搜索
- **部署方案**: Vercel 永久免费部署
- **图片处理**: 前端原生Canvas本地压缩

## 目录结构

```
/workspace
├── src/
│   ├── app/                    # App Router 页面
│   │   ├── layout.tsx          # 根布局
│   │   ├── globals.css         # 全局样式
│   │   ├── page.tsx            # 首页 - 行程规划
│   │   ├── map/page.tsx        # 地图页面
│   │   ├── photos/page.tsx     # 图片素材页面
│   │   └── journal/page.tsx    # 游记页面
│   ├── components/
│   │   ├── ui/                 # 通用UI组件
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Loading.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── TagSelector.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── OfflineDetector.tsx
│   │   ├── layout/             # 布局组件
│   │   │   ├── AppLayout.tsx
│   │   │   └── BottomNav.tsx
│   │   └── plan/               # 行程规划组件
│   │       ├── PlanForm.tsx
│   │       ├── ItineraryTable.tsx
│   │       └── ReviewModal.tsx
│   ├── lib/                    # 工具库
│   │   ├── supabase.ts         # Supabase客户端
│   │   ├── api.ts              # API服务层
│   │   ├── rateLimit.ts        # 限流保护
│   │   ├── storage.ts          # 本地存储
│   │   ├── imageCompress.ts    # 图片压缩
│   │   └── excelExport.ts      # Excel导出
│   └── types/                  # TypeScript类型定义
│       └── index.ts
├── supabase/
│   ├── schema.sql              # 数据库建表脚本
│   └── functions/              # Edge Functions
│       ├── generate_travel_plan/index.ts
│       ├── get_scenic_review/index.ts
│       └── upload_image_auth/index.ts
├── public/                     # 静态资源
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
└── .env.local.example
```

## 快速开始

### 1. 环境准备

复制环境变量示例文件：

```bash
cp .env.local.example .env.local
```

配置以下环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_AMAP_KEY=your_amap_js_api_key
NEXT_PUBLIC_SUPABASE_FUNCTION_URL=your_supabase_functions_url
```

### 2. 安装依赖

```bash
npm install
```

### 3. 本地开发

```bash
npm run dev
```

访问 http://localhost:3000

### 4. 构建生产版本

```bash
npm run build
npm start
```

## Supabase 配置

### 数据库配置

1. 在 [supabase.com](https://supabase.com) 创建免费项目
2. 打开 SQL Editor，执行 `supabase/schema.sql` 中的建表脚本
3. 在 Storage 中创建名为 `travel-photos` 的 bucket（设为私有）

### Edge Functions 部署

安装 Supabase CLI：

```bash
npm install -g supabase
```

登录并关联项目：

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

部署 Edge Functions：

```bash
supabase functions deploy generate_travel_plan
supabase functions deploy get_scenic_review
supabase functions deploy upload_image_auth
```

配置 Edge Functions 环境变量：

```bash
supabase secrets set DOUBAO_API_KEY=your_key
supabase secrets set DOUBAO_API_ENDPOINT=https://ark.cn-beijing.volces.com/api/v3
supabase secrets set DOUBAO_MODEL=doubao-pro-32k
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set SUPABASE_URL=your_supabase_url
supabase secrets set STORAGE_BUCKET=travel-photos
supabase secrets set DAILY_UPLOAD_LIMIT_MB=100
supabase secrets set MAX_FILE_SIZE_MB=20
```

## 高德地图配置

1. 注册 [高德开放平台](https://lbs.amap.com/) 账号
2. 创建应用，添加「Web端(JS API)」Key
3. 将 Key 配置到 `NEXT_PUBLIC_AMAP_KEY` 环境变量

## 豆包大模型配置

1. 注册 [火山引擎](https://www.volcengine.com/) 账号
2. 开通豆包大模型服务
3. 获取 API Key 配置到 Edge Functions 环境变量

## Vercel 部署

### 一键部署

1. Fork 本项目到 GitHub
2. 登录 [Vercel](https://vercel.com)
3. Import Project → 选择 Fork 的仓库
4. 配置环境变量
5. 点击 Deploy

### 环境变量

在 Vercel 项目设置 → Environment Variables 中配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AMAP_KEY`
- `NEXT_PUBLIC_SUPABASE_FUNCTION_URL`

## 功能模块

### 模块一：AI结构化行程规划
- ✅ 极简行程生成表单（5项输入）
- ✅ AI标准化落地行程表格
- ✅ 拖拽排序、增删改
- ✅ 一键Excel本地导出
- ✅ 复制行程、清空行程
- ✅ 本地每日10次限流保护

### 模块二：小红书口碑AI汇总
- ✅ 单点位口碑查询
- ✅ AI降噪提炼真实体验
- ✅ 优缺点、避雷点展示
- ✅ 单景点单日3次限流

### 模块三：高德地图联动
- ✅ 点位彩色标记
- ✅ 点击表格地图居中
- ✅ 一键跳转原生地图导航
- ✅ 地图加载失败兜底

### 模块四：旅行素材轻量化存储
- ✅ 前端Canvas本地压缩
- ✅ 仅存云端/双备份两种模式
- ✅ 一键删除手机原图
- ✅ 按行程分组时间轴浏览

### 模块五：轻量化图文游记
- ✅ 极简编辑器
- ✅ 图片绑定文字
- ✅ 自定义标签
- ✅ 本地离线缓存

## 安全与限流

| 功能 | 限制 | 说明 |
|------|------|------|
| 行程生成 | 10次/天/设备 | 本地 + 服务端双重限流 |
| 景点口碑 | 3次/天/景点 | 本地 + 服务端双重限流 |
| 图片上传 | 100MB/天/设备 | 服务端限流 |
| 单文件大小 | 20MB | 前端 + 服务端校验 |

## 设计规范

- **主色**: #007AFF（苹果原生蓝）
- **AI渐变底色**: #F5F7FF 通透浅蓝渐变
- **圆角**: 统一柔角（6px-24px）
- **字体**: SF Pro 无衬线字体
- **风格**: 极简留白、低饱和通透、克制AI科技感

## 不开发的功能

以下功能严格不开发、不迭代：

- ❌ 用户注册、登录、账号体系
- ❌ 社区、种草、游记广场、社交分享
- ❌ 商城、会员、付费功能、广告
- ❌ 预算记账、行李清单、天气预警
- ❌ 复杂模板、皮肤美化、短视频

## License

MIT
