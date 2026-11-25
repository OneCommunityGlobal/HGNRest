# Imgur 自动发帖功能 - 部署指南

本文档提供了 Imgur 自动发帖功能的完整部署和配置指南。该功能对应后端 PR #1296。

## 📋 文件清单

### 新增文件

| 文件路径 | 描述 |
|---------|------|
| `src/models/imgurPosts.js` | MongoDB Schema，定义定时发布帖子的数据结构 |
| `src/controllers/imgurPostController.js` | Imgur 发帖控制器，处理业务逻辑 |
| `src/routes/imgurPostRouter.js` | API 路由定义 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/startup/routes.js` | 导入并挂载 imgurPostRouter |

## 🔧 环境变量配置

在 `.env` 文件中添加以下配置：

```bash
# Imgur OAuth 配置
IMGUR_CLIENT_ID=your_client_id_here
IMGUR_CLIENT_SECRET=your_client_secret_here
IMGUR_ACCESS_TOKEN=your_access_token_here
IMGUR_REFRESH_TOKEN=your_refresh_token_here
```

### 获取 Imgur 凭证

1. 访问 [Imgur API 开发者页面](https://api.imgur.com/)
2. 注册应用，获得 `Client ID` 和 `Client Secret`
3. 实现 OAuth 流程以获得访问令牌
4. 将这些凭证存储在环境变量中

## 📦 依赖项验证

项目已安装以下必要依赖，**无需额外安装**：

```json
{
  "multer": "^2.2.0",
  "node-schedule": "^2.1.1",
  "axios": "^1.16.1",
  "mongoose": "^5.13.23"
}
```

如需手动安装，运行：
```bash
npm install
```

## 🚀 使用方法

### 1. 立即发送帖子到 Imgur

**请求：**
```http
POST /api/imgur/post
Content-Type: multipart/form-data
Authorization: Bearer <token>

title=我的相册标题
description=相册描述
images=<图片文件1>
images=<图片文件2>
```

**响应示例：**
```json
{
  "success": true,
  "message": "Posted successfully to Imgur",
  "postId": "507f1f77bcf86cd799439011",
  "albumId": "aB12cD3",
  "imgurUrl": "https://imgur.com/a/aB12cD3"
}
```

### 2. 计划发送帖子（定时发布）

**请求：**
```http
POST /api/imgur/post
Content-Type: multipart/form-data
Authorization: Bearer <token>

title=我的相册标题
description=相册描述
scheduleTime=2024-12-20T15:30:00Z
images=<图片文件1>
images=<图片文件2>
```

**响应示例：**
```json
{
  "success": true,
  "message": "Post scheduled successfully",
  "postId": "507f1f77bcf86cd799439012",
  "scheduledTime": "2024-12-20T15:30:00.000Z"
}
```

> **注意：** 确保 `scheduleTime` 设置为未来的时间，否则请求将被拒绝。

### 3. 获取所有已计划的帖子

**请求：**
```http
GET /api/imgur/posts
Authorization: Bearer <token>
```

**响应示例：**
```json
{
  "success": true,
  "posts": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "507f1f77bcf86cd799439010",
      "title": "我的相册",
      "description": "相册描述",
      "status": "pending",
      "scheduledTime": "2024-12-20T15:30:00.000Z",
      "attempts": 0,
      "createdAt": "2024-12-19T10:00:00.000Z",
      "updatedAt": "2024-12-19T10:00:00.000Z"
    }
  ]
}
```

### 4. 更新已计划的帖子

**请求：**
```http
PUT /api/imgur/posts/:postId
Content-Type: multipart/form-data
Authorization: Bearer <token>

title=更新后的标题
description=更新后的描述
scheduleTime=2024-12-21T10:00:00Z
images=<新图片文件>
```

**响应示例：**
```json
{
  "success": true,
  "message": "Post updated successfully",
  "post": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "更新后的标题",
    "scheduledTime": "2024-12-21T10:00:00.000Z",
    ...
  }
}
```

### 5. 删除已计划的帖子

**请求：**
```http
DELETE /api/imgur/posts/:postId
Authorization: Bearer <token>
```

**响应示例：**
```json
{
  "success": true,
  "message": "Scheduled post deleted successfully"
}
```

> **限制：** 只能删除状态为 `pending` 的帖子。已发布或正在发布的帖子无法删除。

### 6. Imgur OAuth 授权

**请求：**
```http
POST /api/imgur/authorize
Content-Type: application/json

{
  "code": "authorization_code_from_imgur"
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "Authorization successful",
  "accessToken": "access_token_here",
  "refreshToken": "refresh_token_here",
  "expiresIn": 3600
}
```

## 🔐 权限要求

所有 Imgur 发帖端点都需要以下权限：
- **权限：** `sendEmails`（与发送公告的权限相同）
- **检查方式：** 通过 `hasPermission(userId, 'sendEmails')` 验证

## 📊 数据库架构

### ImgurPost Schema

```javascript
{
  userId: ObjectId,           // 用户ID（必需，已索引）
  title: String,              // 帖子标题（必需，最大256字符）
  description: String,        // 帖子描述（可选）
  images: [
    {
      filename: String,       // 原始文件名
      mimetype: String,       // MIME 类型
      size: Number,          // 文件大小（字节）
      buffer: Buffer         // 图片二进制数据
    }
  ],
  status: String,             // 状态：pending, publishing, posted, failed（已索引）
  scheduledTime: Date,        // 计划发布时间（已索引）
  postedAt: Date,            // 实际发布时间
  remotePostId: String,       // Imgur 返回的相册ID
  albumId: String,           // Imgur 相册ID
  imgurUrl: String,          // Imgur URL
  lastError: String,         // 最后的错误信息
  attempts: Number,          // 发布尝试次数
  lockOwner: String,         // 分布式锁的拥有者
  lockedUntil: Date,         // 锁的过期时间
  createdAt: Date,           // 创建时间
  updatedAt: Date            // 更新时间
}
```

### 索引

- `{ status: 1, scheduledTime: 1 }` - 用于查询待发布帖子
- `{ userId: 1, createdAt: -1 }` - 用于用户历史查询

## 🔄 工作流程

### 立即发布流程

```
用户提交帖子 → 验证输入 → 上传图片到Imgur → 创建相册 → 保存数据库 → 返回成功
```

### 定时发布流程

```
用户提交帖子（含scheduleTime）
  ↓
验证输入和时间
  ↓
保存到数据库（状态：pending）
  ↓
创建node-schedule定时任务
  ↓
到达计划时间 → 标记为publishing
  ↓
上传图片 → 创建相册
  ↓
更新数据库（状态：posted）
  ↓
完成/失败处理
```

## 📝 文件大小限制

- **单个文件最大值：** 100 MB
- **单个请求最多文件数：** 10 个
- **支持的格式：** JPEG, PNG, GIF, WebP

## ⚠️ 重要注意事项

1. **图片存储**
   - 图片以 Buffer 形式存储在 MongoDB 中
   - 对于大量图片，考虑使用对象存储服务（如 AWS S3）

2. **定时任务管理**
   - 定时任务存储在内存中（使用 Map）
   - 服务器重启后，已计划但未执行的任务将存储在数据库中
   - 启动时需要恢复待执行的任务

3. **并发处理**
   - 使用 `lockOwner` 和 `lockedUntil` 字段防止并发发布
   - 需要在分布式环境中实现适当的锁机制

4. **错误恢复**
   - 失败的帖子会记录错误信息
   - 需要实现重试机制（建议使用独立的后台任务）

## 🛠️ 集成检查清单

- [ ] 环境变量已配置
- [ ] Imgur API 凭证有效
- [ ] 数据库连接正常
- [ ] 用户权限系统正常
- [ ] 文件上传中间件已启用
- [ ] 计划发布的定时任务能正确触发
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 日志记录已启用

## 🧪 测试指南

### 单元测试

```bash
npm test -- src/__tests__/controllers/imgurPostController.test.js
```

### 集成测试

```bash
npm run test:integration
```

### 手动测试（使用 cURL）

```bash
# 立即发送帖子
curl -X POST http://localhost:3000/api/imgur/post \
  -F "title=Test Album" \
  -F "description=Test Description" \
  -F "images=@/path/to/image.jpg" \
  -H "Authorization: Bearer <token>"

# 计划发送帖子
curl -X POST http://localhost:3000/api/imgur/post \
  -F "title=Scheduled Album" \
  -F "scheduleTime=2024-12-20T15:30:00Z" \
  -F "images=@/path/to/image.jpg" \
  -H "Authorization: Bearer <token>"

# 获取已计划的帖子
curl -X GET http://localhost:3000/api/imgur/posts \
  -H "Authorization: Bearer <token>"

# 删除已计划的帖子
curl -X DELETE http://localhost:3000/api/imgur/posts/<postId> \
  -H "Authorization: Bearer <token>"
```

## 🐛 常见问题

### Q: 定时任务不执行？
**A:** 检查：
- 服务器时间是否正确
- `scheduleTime` 是否设置为未来时间
- 服务器是否运行
- 数据库是否可访问

### Q: 上传图片失败？
**A:** 检查：
- 文件格式是否正确（仅支持 JPEG, PNG, GIF, WebP）
- 文件大小是否超过 100MB
- 文件数量是否超过 10 个
- 磁盘空间是否充足

### Q: Imgur API 返回错误？
**A:** 检查：
- Imgur 凭证是否正确
- 访问令牌是否过期
- 网络连接是否正常
- Imgur API 是否正常运行

## 📞 支持与反馈

如有问题或建议，请提交 GitHub Issue 或联系开发团队。

---

**最后更新：** 2024-12-19  
**相关 PR：** #1296  
**版本：** 1.0.0
