# 本地真实 OCR 使用说明

当前版本默认使用 **百度智能云 OCR**。这样你不用处理 OpenAI Platform 的支付限制，也可以先在自己电脑上真实识别图片、保存记录。

## 你需要准备什么

你需要在百度智能云 OCR 里拿到两个值：

- API Key
- Secret Key

这两个值可以理解为：你这个本地小工具调用百度 OCR 服务时使用的“账号钥匙”。

## 第 1 步：打开百度 OCR

打开：

```text
https://cloud.baidu.com/product/ocr.html
```

这一步是在进入百度提供的“图片转文字”服务页面。

## 第 2 步：登录或注册百度智能云

用你的百度账号登录即可。

这一步是在建立一个可以开通 OCR 服务的云账号。

## 第 3 步：进入文字识别 OCR，并创建应用

在百度智能云里找到“文字识别 OCR”，进入后创建一个应用。

这一步是在告诉百度：以后这个小工具会通过这个应用来调用 OCR。

## 第 4 步：复制 API Key 和 Secret Key

创建应用后，在应用详情里复制：

```text
API Key
Secret Key
```

这一步是在拿到本地工具调用百度 OCR 所需的凭证。

## 第 5 步：配置本地 .env

打开项目文件夹里的 `.env`，把内容改成类似这样：

```text
OCR_PROVIDER=baidu
BAIDU_OCR_API_KEY=你的百度APIKey
BAIDU_OCR_SECRET_KEY=你的百度SecretKey
BAIDU_OCR_ENDPOINT=accurate_basic
```

说明：

- `accurate_basic` 是通用文字识别高精度版。
- 如果以后想换成标准版，可以改成 `general_basic`。
- `.env` 只放在你自己的电脑上，不要上传到 GitHub。

## 第 6 步：启动本地服务

双击：

```text
START_LOCAL.bat
```

然后打开：

```text
http://localhost:8787
```

注意：真实 OCR 必须通过这个地址打开，不要用 `file:///.../index.html` 打开。

## 第 7 步：使用 OCR

1. 选择小朋友。
2. 选择或创建课文。
3. 进入“拍课文/习题”。
4. 上传一张或多张图片。
5. 调整图片顺序。
6. 点击“一键 OCR”。
7. 等识别结果出现在文本框里。
8. 手动校对后保存素材。

## 常见问题

### 提示缺少 BAIDU_OCR_API_KEY 或 BAIDU_OCR_SECRET_KEY

说明 `.env` 里还没有填百度的 key，或者文件没有保存。

### OCR 识别失败

可能原因：

- 百度 OCR 服务没有开通。
- API Key 或 Secret Key 填错。
- 图片过大或格式不支持。
- 当前接口免费额度不足，或没有开通对应版本。

### OCR 结果不理想

可以尝试：

- 图片尽量拍正。
- 不要遮挡文字。
- 多页课文先调整好顺序。
- 识别后在文本框里手动校对。

