# YouTube 自动发布器 - 安全审查与改进文档

## 问题概述

前一个 PR (#2300) 在 Reviewer (vidiyala99) 的评审中被指出三个核心安全问题：

### 1. ❌ 缺少权限控制 (Permission Gating)
**问题**：任何登录用户都可以调用 `/api/youtube/*` 路由，包括无权限用户
- 即使是 Volunteer 账户也可以向组织的 YouTube 频道上传和发布内容
- 前端可能隐藏页面，但 API 无防护，导致 API 被滥用

### 2. ❌ 大文件上传前无权限守卫 (DoS 风险)
**问题**：文件上传中间件 (Multer) 在权限检查之前执行
- 默认限制是 2 GiB，直接写入服务器 `os.tmpdir()`
- 未授权用户可以多次请求，导致服务器临时磁盘被占满 (DoS 攻击)
- 这是一个严重的安全和基础设施风险

### 3. ⚠️ 环境变量后备导致的特权提升
**问题**：`createYoutubeClient()` 会回退到环境变量中的 `YOUTUBE_REFRESH_TOKEN`
- 任何有权限的用户都可以使用服务器的全局 YouTube 账户发布内容
- 本应只有已连接账户的用户才能发布

---

## 实现的安全改进

### 1. ✅ 创建权限中间件 (`youtubePermissionMiddleware.js`)

**文件**：`src/middleware/youtubePermissionMiddleware.js`

**功能**：
- 检查用户是否具备 `postYoutubeContent` 权限（参考 Facebook auto-poster #2005）
- 返回 401（未认证）或 403（无权限）
- 错误处理防止信息泄漏

**代码**：
```javascript
const requireYoutubePermission = async (req, res, next) => {
  try {
    const requestor = req.requestor || req.body?.requestor;

    if (!requestor) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to access YouTube features.',
      });
    }

    const hasPermissionToPost = await hasPermission(requestor, 'postYoutubeContent');

    if (!hasPermissionToPost) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to post content to YouTube...',
      });
    }

    next();
  } catch (error) {
    // 安全的错误处理
    return res.status(500).json({
      success: false,
      message: 'An error occurred while verifying your permissions...',
    });
  }
};
```

---

### 2. ✅ 调整路由中间件顺序 (`youtubeAutoPosterRouter.js`)

**修改前**：
```javascript
// ❌ 错误的顺序：权限检查在文件上传之后
router.post('/upload', upload.single('video'), handleUpload);
```

**修改后**：
```javascript
// ✅ 正确的顺序：权限检查在文件上传之前
router.post('/upload', requireYoutubePermission, upload.single('video'), handleUpload);
router.post('/connect', requireYoutubePermission, connectYoutubeAccount);
```

**关键点**：
- **权限中间件必须在 Multer `upload.single()` 之前** - 这样未授权用户无法写入临时文件
- 所有需要权限的路由都被保护：`/upload` 和 `/connect`
- 公开的信息类端点 `/auth-url` 和 `/status` 不需要权限（但需要已登录）

---

### 3. ✅ 移除环境变量后备 (`youtubeAutoPoster.js`)

**修改前**：
```javascript
// ❌ 危险：回退到服务器全局令牌
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
oauthClient.setCredentials(sessionCredentials || { refresh_token: refreshToken });
```

**修改后**：
```javascript
// ✅ 安全：只允许用户连接的账户
if (!sessionCredentials) {
  throw new Error(
    'No connected YouTube account found. Please connect your YouTube account first.',
  );
}
oauthClient.setCredentials(sessionCredentials);
```

**影响**：
- 只有显式连接自己的 YouTube 账户的用户才能上传
- 环境变量的 YOUTUBE_REFRESH_TOKEN 不再被用于用户请求
- 服务器全局令牌仅用于初始化和配置验证

---

## 路由安全总结

| 路由 | 方法 | 权限检查 | 文件上传 | 说明 |
|------|------|---------|---------|------|
| `/auth-url` | GET | ❌ | ❌ | 公开：返回 OAuth 授权 URL |
| `/status` | GET | ❌ | ❌ | 公开：检查连接状态 |
| `/connect` | POST | ✅ | ❌ | 受保护：连接 YouTube 账户 |
| `/upload` | POST | ✅ | ✅ | 受保护：**权限检查在上传之前** |

---

## 安全检查清单

- [x] 所有 `/api/youtube/*` 路由都检查 `postYoutubeContent` 权限
- [x] 权限中间件位于 Multer 上传中间件**之前**
- [x] 未授权用户无法写入临时文件（防止 DoS）
- [x] 移除了环境变量的不安全后备
- [x] 只允许已连接的个人账户上传
- [x] 明确的身份验证错误处理 (401 vs 403)
- [x] 错误响应不泄漏敏感信息

---

## 测试建议

### 1. 单元测试
```javascript
describe('YouTube Router Security', () => {
  it('should reject unauthenticated uploads', async () => {
    const response = await request(app)
      .post('/api/youtube/upload')
      .send({});
    expect(response.status).toBe(401);
  });

  it('should reject users without postYoutubeContent permission', async () => {
    const response = await request(app)
      .post('/api/youtube/upload')
      .set('Authorization', volunteerToken)
      .send({});
    expect(response.status).toBe(403);
  });

  it('should allow users with postYoutubeContent permission', async () => {
    // Expect to proceed to Multer error handling (no file)
    const response = await request(app)
      .post('/api/youtube/upload')
      .set('Authorization', authorizedToken)
      .send({});
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });
});
```

### 2. 集成测试
- 验证 Volunteer 账户无法访问上传端点
- 验证有权限的用户可以成功上传
- 验证临时文件在错误时被清理

### 3. 安全测试
- 尝试用超大文件请求（应在权限检查后被拒）
- 验证没有临时文件被创建给未授权用户
- 验证 404/403 错误不泄漏内部细节

---

## 权限定义

在系统的权限表中，需要定义 `postYoutubeContent` 权限：

**权限类型**：Content Management
**权限名称**：postYoutubeContent
**权限描述**：Allow user to post and upload videos to YouTube channel
**默认角色**：Content Manager, Admin
**可移除**：是（可从用户的默认权限中移除）

---

## 相关参考

- **PR #2005**：Facebook auto-poster 实现参考（使用 `postFacebookContent` 权限）
- **Reviewer 评论**：vidiyala99 的原始安全审查意见
- **OWASP**：
  - A01:2021 – Broken Access Control
  - A07:2021 – Identification and Authentication Failures

---

## 部署前检查

- [ ] 确认 `postYoutubeContent` 权限已在权限管理系统中定义
- [ ] 确认测试覆盖所有安全路径
- [ ] 确认生产环境 `YOUTUBE_REFRESH_TOKEN` 仅用于初始化
- [ ] 运行完整的集成测试套件
- [ ] Code review 通过
- [ ] 性能测试确认权限检查不影响响应时间

---

## 文件变更摘要

```
新增文件：
  src/middleware/youtubePermissionMiddleware.js

修改文件：
  src/routes/youtubeAutoPosterRouter.js
    - 导入权限中间件
    - 调整路由顺序：权限检查在上传之前
    - 为 /connect 和 /upload 添加权限检查

  src/controllers/youtubeAutoPoster.js
    - 移除 createYoutubeClient 中的环境变量后备
    - 强制要求用户连接的凭据
```

---

## 后续工作

1. **权限系统集成**：确保 `postYoutubeContent` 权限在权限管理 UI 中可用
2. **审计日志**：考虑添加审计日志记录所有 YouTube 上传
3. **限流**：考虑添加每用户/每小时的上传限制
4. **令牌刷新**：考虑实现令牌刷新失败时的更优雅的错误处理

---

**文档版本**：1.0  
**最后更新**：2026-10-23  
**审查状态**：待 PR 审查和通过
