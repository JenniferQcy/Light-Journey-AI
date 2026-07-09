# Supabase Edge Functions 配置

## 环境变量设置

在Supabase控制台的Edge Functions设置中，添加以下环境变量：

```
DOUBAO_API_KEY=your_doubao_api_key
DOUBAO_API_ENDPOINT=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=doubao-pro-32k
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_URL=your_supabase_url
STORAGE_BUCKET=travel-photos
DAILY_UPLOAD_LIMIT_MB=100
MAX_FILE_SIZE_MB=20
```

## 部署命令

```bash
# 部署所有函数
supabase functions deploy generate_travel_plan
supabase functions deploy get_scenic_review
supabase functions deploy upload_image_auth
```

## 函数说明

### generate_travel_plan
- 接收用户行程参数，调用豆包大模型生成结构化行程
- 限流：每个匿名ID每天10次
- 超时：30秒

### get_scenic_review
- 接收景点名称，调用豆包联网搜索生成小红书口碑摘要
- 限流：每个景点每天每ID 3次
- 有缓存机制，相同景点24小时内复用缓存

### upload_image_auth
- 生成图片上传的预签名URL
- 限制单文件大小和每日上传总量
- 返回压缩图和原图的上传路径
