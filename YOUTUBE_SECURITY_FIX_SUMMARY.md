# YouTube 自动发布器 - 安全改进补丁

## 摘要

本补丁对 PR #2300 的 YouTube 自动发布器后端实现进行了**严格的安全加固**，针对 Reviewer vidiyala99 指出的三个关键安全问题进行了完整修复：

1. ✅ **权限控制缺失** - 添加了 `postYoutubeContent` 权限检查
2. ✅ **大文件 DoS 风险** - 将权限检查移到文件上传中间件之前
3. ✅ **特权提升风险** - 移除了环境变量后备，强制使用用户连接的账户

---

## 核心改进

### 改进 1：新增权限中间件

**文件**：`src/middleware/youtubePermissionMiddleware.js` (新增)

**功能**：
- 检查请求中是否包含 `requestor` 信息（来自认证系统）
- 验证用户是否具备 `postYoutubeContent` 权限
- 返回明确的错误响应（401 未认证，403 无权限）
- 安全的错误处理，不泄漏内部细节

**关键代码**：
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
        message: 'You do not have permission to post content to YouTube. Please contact your administrator.',
      });
    }

    next();
  } catch (error) {
    // 安全地处理错误，不暴露内部信息
    console.error('YouTube permission check error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while verifying your permissions. Please try again.',
    });
  }
};
```

---

### 改进 2：调整路由中间件顺序

**文件**：`src/routes/youtubeAutoPosterRouter.js`

**修改内容**：

**之前（不安全）**：
```javascript
router.get('/auth-url', getYoutubeAuthorizationUrl);
router.get('/status', getYoutubeConnectionStatus);
router.post('/connect', connectYoutubeAccount);
router.post('/upload', upload.single('video'), handleUpload);  // ❌ 上传在权限之前
```

**之后（安全）**：
```javascript
// 公开端点 - 不需要权限，但应正确处理认证
router.get('/auth-url', getYoutubeAuthorizationUrl);
router.get('/status', getYoutubeConnectionStatus);

// 受保护端点 - 权限检查在上传中间件之前
// 这样可以防止未授权用户向临时磁盘写入大文件
router.post('/connect', requireYoutubePermission, connectYoutubeAccount);
router.post('/upload', requireYoutubePermission, upload.single('video'), handleUpload);
```

**关键改进**：
- ✅ 权限中间件 (`requireYoutubePermission`) 在 Multer 上传中间件之前
- ✅ 防止未授权用户在磁盘空间上进行 DoS 攻击
- ✅ 所有写入操作都受到权限保护

---

### 改进 3：移除环境变量特权提升

**文件**：`src/controllers/youtubeAutoPoster.js`

**修改内容**：

**之前（不安全）**：
```javascript
const createYoutubeClient = (req) => {
  const oauthClient = createOAuthClient();
  const requestorId = getRequestorId(req);
  const sessionCredentials =
    requestorId && req.session?.youtubeConnectedUserId === requestorId
      ? req.session.youtubeCredentials
      : undefined;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;  // ❌ 危险的后备

  if (!sessionCredentials && !refreshToken) {
    throw new Error('Missing YouTube OAuth configuration: YOUTUBE_REFRESH_TOKEN');
  }

  // 使用服务器全局令牌作为后备 - 任何有权限的用户都可以用组织账户发布
  oauthClient.setCredentials(sessionCredentials || { refresh_token: refreshToken });
  return google.youtube({ version: 'v3', auth: oauthClient });
};
```

**之后（安全）**：
```javascript
const createYoutubeClient = (req) => {
  const oauthClient = createOAuthClient();
  const requestorId = getRequestorId(req);
  const sessionCredentials =
    requestorId && req.session?.youtubeConnectedUserId === requestorId
      ? req.session.youtubeCredentials
      : undefined;

  if (!sessionCredentials) {
    // 仅允许用户连接的账户，不使用服务器后备令牌
    throw new Error(
      'No connected YouTube account found. Please connect your YouTube account first.',
    );
  }

  oauthClient.setCredentials(sessionCredentials);
  return google.youtube({ version: 'v3', auth: oauthClient });
};
```

**关键改进**：
- ✅ 移除了环境变量 `YOUTUBE_REFRESH_TOKEN` 的不安全后备
- ✅ 强制要求用户必须通过 `/connect` 端点连接自己的 YouTube 账户
- ✅ 防止未授权用户使用服务器的组织账户发布内容
- ✅ 明确的错误消息引导用户完成 OAuth 流程

---

### 改进 4：添加单元测试

**文件**：`src/middleware/__tests__/youtubePermissionMiddleware.test.js` (新增)

**测试覆盖**：
- 缺少 requestor 时返回 401
- 权限检查成功时调用 next()
- 权限不足时返回 403
- 错误安全处理不泄漏信息
- 优先使用 req.requestor 而不是 req.body.requestor（防止 Multer 替换后被覆盖）

---

## 安全分析

### 攻击场景 1：无权限用户上传视频 (DoS)

**攻击前**：
```
未授权用户 → POST /api/youtube/upload (2GB 视频)
  → Multer 接收并写入 /tmp/youtube-uuid
  → 服务器磁盘被填满
```

**修复后**：
```
未授权用户 → POST /api/youtube/upload
  → requireYoutubePermission 中间件检查权限
  → ✅ 返回 401/403
  → ❌ 不调用 Multer，不写入文件
```

### 攻击场景 2：特权提升

**攻击前**：
```
有权限的用户 → POST /api/youtube/upload
  → 即使用户从未连接自己的账户
  → 使用 YOUTUBE_REFRESH_TOKEN (组织账户)
  → 以组织身份发布视频 (特权提升)
```

**修复后**：
```
有权限的用户（未连接） → POST /api/youtube/upload
  → createYoutubeClient 检查 sessionCredentials
  → ✅ 找不到用户连接的账户
  → ❌ 返回明确的错误：需要先连接账户
```

---

## 权限定义需求

在系统的权限管理中需要添加以下权限定义：

```
权限名称：postYoutubeContent
权限描述：Allow user to post and upload videos to YouTube channel
权限类型：Content Management
默认角色：Content Manager, Administrator
可移除：是（可从用户的默认权限中移除）
关联模块：YouTube Auto Poster
```

参考实现：Facebook auto-poster (PR #2005) 使用 `postFacebookContent` 权限

---

## 部署检查清单

- [ ] `postYoutubeContent` 权限已在权限管理系统中定义
- [ ] 内容管理员和管理员默认具有此权限
- [ ] 单元测试通过 (`npm test -- src/middleware/__tests__/youtubePermissionMiddleware.test.js`)
- [ ] 集成测试验证以下场景：
  - [ ] 未认证用户无法访问 `/upload`
  - [ ] 无权限的志愿者无法访问 `/upload`
  - [ ] 有权限的用户可以访问但需要已连接的账户
  - [ ] 临时文件在所有失败场景下都被清理
- [ ] 性能测试确认权限检查不影响响应时间
- [ ] Code review 通过
- [ ] 生产环境不依赖 `YOUTUBE_REFRESH_TOKEN` 用于用户上传

---

## 相关代码文件

### 新增文件
```
src/middleware/youtubePermissionMiddleware.js
src/middleware/__tests__/youtubePermissionMiddleware.test.js
YOUTUBE_SECURITY_REVIEW.md
```

### 修改文件
```
src/routes/youtubeAutoPosterRouter.js
  - 导入权限中间件
  - 调整路由顺序
  
src/controllers/youtubeAutoPoster.js
  - 移除环境变量后备
  - 改进错误处理
```

---

## 审查建议

### 对于 Security Reviewer
- 验证权限检查顺序是否正确
- 检查是否存在绕过权限检查的路径
- 审查错误响应是否泄漏信息

### 对于 Backend Reviewer
- 确认权限系统集成是否正确
- 验证与现有权限检查的一致性
- 性能影响分析

### 对于 QA
- 测试未认证用户的行为
- 测试无权限用户的行为
- 测试有权限但未连接账户的用户行为
- 验证临时文件清理
- 压力测试磁盘写入保护

---

## 参考资源

- **OWASP Top 10**
  - A01:2021 – Broken Access Control
  - A07:2021 – Identification and Authentication Failures
  - A04:2021 – Insecure Deserialization (DoS)

- **相似实现**
  - Facebook auto-poster (PR #2005) - `postFacebookContent` 权限
  - Job application upload (PR #2412) - 服务端上传限制

- **原始审查**
  - PR #2300 - vidiyala99 的安全评论

---

## 后续建议

1. **审计日志**：记录所有 YouTube 上传操作
2. **速率限制**：考虑添加每用户/每小时的上传限制
3. **令牌管理**：实现令牌过期时的优雅处理
4. **监控告警**：添加异常上传模式检测

---

**文档版本**：1.0  
**创建日期**：2026-10-23  
**对应 PR**：#2300 - YouTube Auto Poster  
**对应审查**：vidiyala99 的安全评论  
**状态**：待审查和合并
