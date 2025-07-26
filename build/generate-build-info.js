const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BuildInfoGenerator {
  constructor() {
    this.rootDir = path.join(__dirname, '..');
    this.packageJson = require('../package.json');
  }

  generateBuildInfo() {
    console.log('Generating build information...');
    
    const buildInfo = {
      version: this.packageJson.version,
      buildNumber: this.getBuildNumber(),
      buildDate: new Date().toISOString(),
      gitCommit: this.getGitCommit(),
      gitBranch: this.getGitBranch(),
      gitTag: this.getGitTag(),
      buildEnvironment: process.env.NODE_ENV || 'development',
      buildPlatform: process.platform,
      buildArch: process.arch,
      nodeVersion: process.version,
      electronVersion: this.getElectronVersion(),
      dependencies: this.getDependencyVersions(),
      buildFlags: this.getBuildFlags(),
      timestamp: Date.now()
    };

    // Write build info to multiple locations
    this.writeBuildInfo(buildInfo);
    
    console.log('Build information generated successfully');
    return buildInfo;
  }

  getBuildNumber() {
    // Try multiple sources for build number
    if (process.env.BUILD_NUMBER) {
      return process.env.BUILD_NUMBER;
    }
    
    if (process.env.GITHUB_RUN_NUMBER) {
      return process.env.GITHUB_RUN_NUMBER;
    }
    
    if (process.env.CI_PIPELINE_ID) {
      return process.env.CI_PIPELINE_ID;
    }
    
    // Generate build number from timestamp if not in CI
    return Math.floor(Date.now() / 1000).toString();
  }

  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.warn('Could not get git commit:', error.message);
      return process.env.GIT_COMMIT || 'unknown';
    }
  }

  getGitBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.warn('Could not get git branch:', error.message);
      return process.env.GIT_BRANCH || 'unknown';
    }
  }

  getGitTag() {
    try {
      return execSync('git describe --tags --exact-match HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      // Not on a tagged commit
      return null;
    }
  }

  getElectronVersion() {
    try {
      const electronPackage = require('electron/package.json');
      return electronPackage.version;
    } catch (error) {
      return 'unknown';
    }
  }

  getDependencyVersions() {
    const dependencies = {};
    const criticalDeps = [
      'electron',
      'tesseract.js',
      'openai',
      'sqlite3',
      'faiss-node'
    ];

    for (const dep of criticalDeps) {
      try {
        const packagePath = path.join(this.rootDir, 'node_modules', dep, 'package.json');
        if (fs.existsSync(packagePath)) {
          const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          dependencies[dep] = pkg.version;
        }
      } catch (error) {
        dependencies[dep] = 'unknown';
      }
    }

    return dependencies;
  }

  getBuildFlags() {
    const flags = {};
    
    // Environment flags
    flags.production = process.env.NODE_ENV === 'production';
    flags.development = process.env.NODE_ENV === 'development';
    flags.ci = !!(process.env.CI || process.env.CONTINUOUS_INTEGRATION);
    
    // Build configuration flags
    flags.codeSigningEnabled = !!(process.env.MACOS_SIGNING_IDENTITY || process.env.WINDOWS_CERT_FILE);
    flags.notarizationEnabled = !!(process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD);
    flags.autoUpdateEnabled = !!process.env.ENABLE_AUTO_UPDATE;
    
    // Feature flags
    flags.debugMode = !!process.env.DEBUG;
    flags.telemetryEnabled = !!process.env.ENABLE_TELEMETRY;
    flags.betaFeatures = !!process.env.ENABLE_BETA_FEATURES;
    
    return flags;
  }

  writeBuildInfo(buildInfo) {
    // Write to dist directory (for packaged app)
    const distPath = path.join(this.rootDir, 'dist', 'build-info.json');
    this.ensureDirectoryExists(path.dirname(distPath));
    fs.writeFileSync(distPath, JSON.stringify(buildInfo, null, 2));
    
    // Write to root directory (for development)
    const rootPath = path.join(this.rootDir, 'build-info.json');
    fs.writeFileSync(rootPath, JSON.stringify(buildInfo, null, 2));
    
    // Write to assets directory (backup location)
    const assetsPath = path.join(this.rootDir, 'assets', 'build-info.json');
    this.ensureDirectoryExists(path.dirname(assetsPath));
    fs.writeFileSync(assetsPath, JSON.stringify(buildInfo, null, 2));
    
    // Generate human-readable version
    const readablePath = path.join(this.rootDir, 'dist', 'build-info.txt');
    fs.writeFileSync(readablePath, this.generateReadableBuildInfo(buildInfo));
    
    console.log(`Build info written to:`);
    console.log(`  - ${distPath}`);
    console.log(`  - ${rootPath}`);
    console.log(`  - ${assetsPath}`);
    console.log(`  - ${readablePath}`);
  }

  generateReadableBuildInfo(buildInfo) {
    let info = `Interview Assistant - Build Information\n`;
    info += `${'='.repeat(50)}\n\n`;
    
    info += `Version: ${buildInfo.version}\n`;
    info += `Build Number: ${buildInfo.buildNumber}\n`;
    info += `Build Date: ${new Date(buildInfo.buildDate).toLocaleString()}\n`;
    info += `Environment: ${buildInfo.buildEnvironment}\n`;
    info += `Platform: ${buildInfo.buildPlatform} (${buildInfo.buildArch})\n\n`;
    
    info += `Git Information:\n`;
    info += `  Commit: ${buildInfo.gitCommit}\n`;
    info += `  Branch: ${buildInfo.gitBranch}\n`;
    if (buildInfo.gitTag) {
      info += `  Tag: ${buildInfo.gitTag}\n`;
    }
    info += `\n`;
    
    info += `Runtime Versions:\n`;
    info += `  Node.js: ${buildInfo.nodeVersion}\n`;
    info += `  Electron: ${buildInfo.electronVersion}\n\n`;
    
    info += `Dependencies:\n`;
    Object.entries(buildInfo.dependencies).forEach(([name, version]) => {
      info += `  ${name}: ${version}\n`;
    });
    info += `\n`;
    
    info += `Build Flags:\n`;
    Object.entries(buildInfo.buildFlags).forEach(([flag, value]) => {
      info += `  ${flag}: ${value}\n`;
    });
    
    return info;
  }

  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  generateVersionFile() {
    console.log('Generating version file...');
    
    const versionInfo = {
      version: this.packageJson.version,
      name: this.packageJson.name,
      productName: this.packageJson.productName,
      description: this.packageJson.description,
      buildDate: new Date().toISOString(),
      buildNumber: this.getBuildNumber()
    };

    const versionPath = path.join(this.rootDir, 'dist', 'version.json');
    this.ensureDirectoryExists(path.dirname(versionPath));
    fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
    
    console.log(`Version file written to: ${versionPath}`);
    return versionInfo;
  }

  updatePackageVersion(newVersion) {
    console.log(`Updating package version to ${newVersion}...`);
    
    this.packageJson.version = newVersion;
    
    const packagePath = path.join(this.rootDir, 'package.json');
    fs.writeFileSync(packagePath, JSON.stringify(this.packageJson, null, 2));
    
    console.log('Package version updated successfully');
  }

  validateBuildEnvironment() {
    console.log('Validating build environment...');
    
    const issues = [];
    const warnings = [];
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 16) {
      issues.push(`Node.js version ${nodeVersion} is too old. Minimum required: 16.x`);
    }
    
    // Check for required environment variables in production
    if (process.env.NODE_ENV === 'production') {
      const requiredVars = ['BUILD_NUMBER', 'GIT_COMMIT'];
      for (const varName of requiredVars) {
        if (!process.env[varName]) {
          warnings.push(`Missing environment variable: ${varName}`);
        }
      }
    }
    
    // Check for code signing certificates
    if (process.platform === 'darwin' && !process.env.MACOS_SIGNING_IDENTITY) {
      warnings.push('macOS code signing identity not configured');
    }
    
    if (process.platform === 'win32' && !process.env.WINDOWS_CERT_FILE) {
      warnings.push('Windows code signing certificate not configured');
    }
    
    // Check git repository
    try {
      execSync('git status', { stdio: 'ignore' });
    } catch (error) {
      warnings.push('Not in a git repository or git not available');
    }
    
    // Report results
    if (issues.length > 0) {
      console.error('Build environment validation failed:');
      issues.forEach(issue => console.error(`  ❌ ${issue}`));
      process.exit(1);
    }
    
    if (warnings.length > 0) {
      console.warn('Build environment warnings:');
      warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
    }
    
    console.log('Build environment validation completed');
    return { issues, warnings };
  }
}

module.exports = BuildInfoGenerator;

// CLI usage
if (require.main === module) {
  const generator = new BuildInfoGenerator();
  const command = process.argv[2] || 'generate';
  
  try {
    switch (command) {
      case 'generate':
        generator.generateBuildInfo();
        generator.generateVersionFile();
        break;
        
      case 'validate':
        generator.validateBuildEnvironment();
        break;
        
      case 'version':
        const newVersion = process.argv[3];
        if (!newVersion) {
          console.error('Usage: node generate-build-info.js version <new-version>');
          process.exit(1);
        }
        generator.updatePackageVersion(newVersion);
        break;
        
      default:
        console.log('Usage: node generate-build-info.js [generate|validate|version]');
        break;
    }
  } catch (error) {
    console.error('Build info generation failed:', error);
    process.exit(1);
  }
}