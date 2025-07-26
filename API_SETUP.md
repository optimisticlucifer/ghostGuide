# API Key Setup Guide

This guide walks you through setting up API keys for Interview Assistant's AI features.

## Table of Contents

1. [OpenAI API Setup](#openai-api-setup)
2. [Alternative AI Providers](#alternative-ai-providers)
3. [Security Best Practices](#security-best-practices)
4. [Troubleshooting API Issues](#troubleshooting-api-issues)
5. [Usage Monitoring](#usage-monitoring)

## OpenAI API Setup

### Step 1: Create OpenAI Account

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Click **Sign up** or **Log in** if you have an account
3. Complete email verification if required
4. Add payment method (required for API access)

### Step 2: Generate API Key

1. Navigate to [API Keys page](https://platform.openai.com/api-keys)
2. Click **Create new secret key**
3. Give your key a descriptive name (e.g., "Interview Assistant")
4. **Important**: Copy the key immediately - you won't see it again!
5. Store the key securely (starts with `sk-`)

### Step 3: Configure in Interview Assistant

1. **Launch Interview Assistant**
2. **Open Settings**:
   - Press `G` to open main window
   - Click **Settings** button
3. **Navigate to API Configuration**:
   - Click **API Configuration** tab
4. **Enter API Key**:
   - Paste your OpenAI API key in the **OpenAI API Key** field
   - Click **Test Connection** to verify
   - You should see "✅ Connection successful"
5. **Save Configuration**:
   - Click **Save** to store your settings

### Step 4: Verify Setup

1. **Create a test session**:
   - Select any profession and interview type
   - Click **Start Session**
2. **Test AI features**:
   - Type a message in the chat
   - Try the screenshot OCR feature
   - Verify you get AI responses

## Alternative AI Providers

### Anthropic Claude

1. **Get API Key**:
   - Visit [Anthropic Console](https://console.anthropic.com/)
   - Create account and generate API key

2. **Configure in Interview Assistant**:
   - Settings → API Configuration → Claude API Key
   - Enter your Anthropic API key
   - Test connection

### Azure OpenAI

1. **Set up Azure OpenAI Resource**:
   - Create Azure account
   - Deploy OpenAI resource in Azure portal
   - Note your endpoint URL and API key

2. **Configure in Interview Assistant**:
   - Settings → API Configuration → Azure OpenAI
   - Enter endpoint URL and API key
   - Select deployment name

### Local AI Models (Privacy-Focused)

#### Ollama Setup

1. **Install Ollama**:
   ```bash
   # macOS
   brew install ollama
   
   # Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Windows - download from ollama.ai
   ```

2. **Download a model**:
   ```bash
   # Install a coding-focused model
   ollama pull codellama
   
   # Or a general purpose model
   ollama pull llama2
   ```

3. **Configure Interview Assistant**:
   - Settings → API Configuration → Local AI
   - Endpoint: `http://localhost:11434`
   - Model: `codellama` or your chosen model

#### LM Studio Setup

1. **Download LM Studio**: https://lmstudio.ai/
2. **Download a model** (e.g., Code Llama, Mistral)
3. **Start local server** in LM Studio
4. **Configure Interview Assistant**:
   - Settings → API Configuration → Local AI
   - Endpoint: `http://localhost:1234/v1`

## Security Best Practices

### API Key Security

1. **Never share your API key**:
   - Don't commit to version control
   - Don't share in screenshots or logs
   - Don't include in support requests

2. **Use environment variables** (optional):
   ```bash
   # Add to your shell profile (.bashrc, .zshrc, etc.)
   export OPENAI_API_KEY="your-api-key-here"
   
   # Interview Assistant will automatically detect this
   ```

3. **Rotate keys regularly**:
   - Generate new keys monthly
   - Delete old keys from OpenAI dashboard
   - Update Interview Assistant configuration

4. **Monitor usage**:
   - Check OpenAI usage dashboard regularly
   - Set up billing alerts
   - Review API logs for suspicious activity

### Network Security

1. **Use secure networks**:
   - Avoid public WiFi for sensitive interviews
   - Use VPN if required by your organization

2. **Firewall configuration**:
   ```bash
   # Allow Interview Assistant through firewall
   # macOS
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "/Applications/Interview Assistant.app"
   
   # Windows (run as admin)
   netsh advfirewall firewall add rule name="Interview Assistant" dir=out action=allow program="C:\Program Files\Interview Assistant\Interview Assistant.exe"
   ```

### Data Privacy

1. **Local processing options**:
   - Use local AI models when possible
   - Enable OCR caching to reduce API calls
   - Configure data retention settings

2. **Session data management**:
   - Settings → Privacy → Auto-delete sessions → 30 days
   - Settings → Privacy → Encrypt session data → Enable
   - Regularly clear old session data

## Troubleshooting API Issues

### Common Error Messages

#### "Invalid API key"
**Causes**:
- Incorrect API key format
- Expired or revoked key
- Copy/paste errors

**Solutions**:
1. **Verify key format**: Should start with `sk-` for OpenAI
2. **Check for extra characters**: No spaces or newlines
3. **Generate new key**: Create fresh key in OpenAI dashboard
4. **Test manually**:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        https://api.openai.com/v1/models
   ```

#### "Rate limit exceeded"
**Causes**:
- Too many requests per minute
- Exceeded monthly quota
- Insufficient API plan

**Solutions**:
1. **Check usage**: Visit OpenAI usage dashboard
2. **Reduce request frequency**: Settings → API → Request Delay → 2000ms
3. **Upgrade plan**: Consider higher tier for more requests
4. **Optimize prompts**: Shorter prompts = fewer tokens

#### "Insufficient quota"
**Causes**:
- Exceeded spending limit
- Payment method issues
- Account restrictions

**Solutions**:
1. **Check billing**: Verify payment method in OpenAI account
2. **Increase limits**: Adjust spending limits if needed
3. **Add credits**: Purchase additional credits
4. **Contact OpenAI**: For account-specific issues

#### "Connection timeout"
**Causes**:
- Network connectivity issues
- Firewall blocking requests
- DNS resolution problems

**Solutions**:
1. **Test connectivity**:
   ```bash
   ping api.openai.com
   curl -I https://api.openai.com
   ```
2. **Check firewall settings**
3. **Try different DNS**: Use 8.8.8.8 or 1.1.1.1
4. **Configure proxy**: If behind corporate firewall

### Advanced Troubleshooting

#### Enable API Debug Logging

1. **Enable debug mode**:
   - Settings → Advanced → Debug Mode → Enable
   - Settings → Logging → API Requests → Enable

2. **Check logs**:
   ```bash
   # macOS
   tail -f ~/Library/Logs/Interview\ Assistant/api.log
   
   # Windows
   type "%APPDATA%\Interview Assistant\logs\api.log"
   
   # Linux
   tail -f ~/.local/share/interview-assistant/logs/api.log
   ```

#### Test API Manually

```bash
# Test OpenAI API
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 50
  }'

# Test Anthropic API
curl -X POST https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-sonnet-20240229",
    "max_tokens": 50,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Usage Monitoring

### OpenAI Usage Dashboard

1. **Access dashboard**: https://platform.openai.com/usage
2. **Monitor metrics**:
   - Requests per day/month
   - Token usage
   - Cost breakdown
   - Error rates

3. **Set up alerts**:
   - Billing alerts for spending limits
   - Usage alerts for high consumption
   - Email notifications for issues

### Interview Assistant Usage Stats

1. **View usage statistics**:
   - Settings → Usage → View Statistics
   - See API calls, tokens used, costs

2. **Export usage data**:
   - Settings → Usage → Export Data
   - CSV format for analysis

### Cost Optimization

#### Reduce API Costs

1. **Optimize prompts**:
   - Use shorter, more specific prompts
   - Remove unnecessary context
   - Use system messages effectively

2. **Enable caching**:
   - Settings → Performance → Cache Responses → Enable
   - Settings → OCR → Cache Results → Enable

3. **Use appropriate models**:
   - GPT-3.5-turbo for general tasks (cheaper)
   - GPT-4 only when needed (more expensive)

4. **Batch requests**:
   - Settings → API → Batch Mode → Enable
   - Combine multiple requests when possible

#### Monitor Spending

```bash
# Set spending alerts in OpenAI dashboard
# Recommended limits:
# - Soft limit: $20/month (warning)
# - Hard limit: $50/month (stop)
```

### Usage Best Practices

1. **Regular monitoring**:
   - Check usage weekly
   - Review cost trends
   - Identify high-usage features

2. **Optimize usage patterns**:
   - Use local processing when possible
   - Cache frequently used responses
   - Avoid redundant API calls

3. **Plan for scaling**:
   - Estimate monthly usage
   - Budget for API costs
   - Consider enterprise plans for heavy usage

## Support and Resources

### Official Documentation

- **OpenAI API Docs**: https://platform.openai.com/docs
- **Anthropic API Docs**: https://docs.anthropic.com/
- **Azure OpenAI Docs**: https://docs.microsoft.com/azure/cognitive-services/openai/

### Community Resources

- **OpenAI Community**: https://community.openai.com/
- **Interview Assistant Forum**: https://community.interviewassistant.com/
- **GitHub Discussions**: https://github.com/interview-assistant/app/discussions

### Getting Help

If you're still having issues with API setup:

1. **Check troubleshooting section** above
2. **Search existing issues**: GitHub issues page
3. **Contact support**: support@interviewassistant.com
4. **Include in your report**:
   - API provider (OpenAI, Claude, etc.)
   - Error messages (remove API keys!)
   - Steps you've already tried
   - System information

---

**Ready to start?** Follow the OpenAI setup steps above to get your Interview Assistant powered by AI!