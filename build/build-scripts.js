const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const InstallerBuilder = require('./installer-config');

class BuildManager {
  constructor() {
    this.rootDir = path.join(__dirname, '..');
    this.buildDir = path.join(this.rootDir, 'dist');
    this.nodeModulesDir = path.join(this.rootDir, 'node_modules');
  }

  async cleanBuild() {
    console.log('Cleaning previous build...');
    
    if (fs.existsSync(this.buildDir)) {
      fs.rmSync(this.buildDir, { recursive: true, force: true });
    }
    
    const installerDir = path.join(this.rootDir, 'installers');
    if (fs.existsSync(installerDir)) {
      fs.rmSync(installerDir, { recursive: true, force: true });
    }
    
    console.log('Build directories cleaned.');
  }

  async installDependencies() {
    console.log('Installing dependencies...');
    
    try {
      // Install production dependencies
      execSync('npm ci --only=production', {
        cwd: this.rootDir,
        stdio: 'inherit'
      });
      
      // Install native dependencies for current platform
      execSync('npm rebuild', {
        cwd: this.rootDir,
        stdio: 'inherit'
      });
      
      console.log('Dependencies installed successfully.');
    } catch (error) {
      console.error('Failed to install dependencies:', error);
      throw error;
    }
  }

  async buildApplication() {
    console.log('Building application...');
    
    try {
      // Generate build information
      console.log('Generating build information...');
      const BuildInfoGenerator = require('./generate-build-info');
      const buildInfoGenerator = new BuildInfoGenerator();
      buildInfoGenerator.validateBuildEnvironment();
      buildInfoGenerator.generateBuildInfo();
      buildInfoGenerator.generateVersionFile();
      
      // Compile TypeScript
      console.log('Compiling TypeScript...');
      execSync('npx tsc', {
        cwd: this.rootDir,
        stdio: 'inherit'
      });
      
      // Build renderer assets
      console.log('Building renderer assets...');
      this.copyRendererAssets();
      
      // Copy necessary files
      this.copyAssets();
      
      console.log('Application built successfully.');
    } catch (error) {
      console.error('Failed to build application:', error);
      throw error;
    }
  }

  copyRendererAssets() {
    const rendererSrc = path.join(this.rootDir, 'src', 'renderer');
    const rendererDest = path.join(this.buildDir, 'renderer');
    
    if (!fs.existsSync(rendererDest)) {
      fs.mkdirSync(rendererDest, { recursive: true });
    }
    
    // Copy HTML files
    const htmlFiles = fs.readdirSync(rendererSrc).filter(file => file.endsWith('.html'));
    for (const file of htmlFiles) {
      fs.copyFileSync(
        path.join(rendererSrc, file),
        path.join(rendererDest, file)
      );
    }
    
    // Copy JS files (already compiled or static)
    const jsFiles = fs.readdirSync(rendererSrc).filter(file => file.endsWith('.js'));
    for (const file of jsFiles) {
      fs.copyFileSync(
        path.join(rendererSrc, file),
        path.join(rendererDest, file)
      );
    }
    
    console.log('Renderer assets copied.');
  }

  copyAssets() {
    const assetsSrc = path.join(this.rootDir, 'assets');
    const assetsDest = path.join(this.buildDir, 'assets');
    
    if (fs.existsSync(assetsSrc)) {
      this.copyDirectory(assetsSrc, assetsDest);
      console.log('Assets copied.');
    }
    
    // Copy package.json
    fs.copyFileSync(
      path.join(this.rootDir, 'package.json'),
      path.join(this.buildDir, 'package.json')
    );
    
    // Copy necessary config files
    const configFiles = ['tsconfig.json'];
    for (const file of configFiles) {
      const srcPath = path.join(this.rootDir, file);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, path.join(this.buildDir, file));
      }
    }
  }

  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      
      if (fs.statSync(srcPath).isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  async packageElectron() {
    console.log('Packaging Electron application...');
    
    const electronPackager = require('electron-packager');
    const platform = process.platform;
    const arch = process.arch;
    
    const options = {
      dir: this.buildDir,
      name: 'Interview Assistant',
      platform: platform,
      arch: arch,
      out: this.buildDir,
      overwrite: true,
      asar: true,
      icon: this.getIconPath(platform),
      prune: true,
      ignore: [
        /\/\./,
        /node_modules\/.*\/test/,
        /node_modules\/.*\/tests/,
        /node_modules\/.*\/.git/,
        /src/,
        /build/,
        /installers/,
        /\.ts$/
      ],
      appBundleId: 'com.interviewassistant.app',
      appVersion: require('../package.json').version,
      buildVersion: require('../package.json').version,
      appCopyright: 'Copyright © 2024 Interview Assistant Team',
      win32metadata: {
        CompanyName: 'Interview Assistant Team',
        FileDescription: 'AI-powered interview assistance',
        OriginalFilename: 'Interview Assistant.exe',
        ProductName: 'Interview Assistant',
        InternalName: 'InterviewAssistant'
      },
      osxSign: {
        identity: process.env.MACOS_SIGNING_IDENTITY,
        'hardened-runtime': true,
        'gatekeeper-assess': false,
        entitlements: path.join(__dirname, 'entitlements.plist'),
        'entitlements-inherit': path.join(__dirname, 'entitlements.plist')
      },
      osxNotarize: {
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID
      }
    };
    
    try {
      const appPaths = await electronPackager(options);
      console.log('Electron packaging completed:', appPaths);
      return appPaths;
    } catch (error) {
      console.error('Failed to package Electron app:', error);
      throw error;
    }
  }

  getIconPath(platform) {
    const assetsDir = path.join(this.rootDir, 'assets');
    
    switch (platform) {
      case 'win32':
        return path.join(assetsDir, 'icon.ico');
      case 'darwin':
        return path.join(assetsDir, 'icon.icns');
      case 'linux':
        return path.join(assetsDir, 'icon.png');
      default:
        return path.join(assetsDir, 'icon.png');
    }
  }

  async createInstallers() {
    console.log('Creating installers...');
    
    const builder = new InstallerBuilder();
    const results = await builder.createAllInstallers();
    
    // Create portable version
    const portable = await builder.createPortableVersion();
    results.push(portable);
    
    // Generate checksums
    await builder.generateChecksums();
    
    return results;
  }

  async runFullBuild() {
    console.log('Starting full build process...');
    const startTime = Date.now();
    
    try {
      await this.cleanBuild();
      await this.installDependencies();
      await this.buildApplication();
      const appPaths = await this.packageElectron();
      const installers = await this.createInstallers();
      
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      
      console.log('\n=== BUILD COMPLETED SUCCESSFULLY ===');
      console.log(`Total build time: ${duration} seconds`);
      console.log('\nPackaged applications:');
      appPaths.forEach(path => console.log(`  - ${path}`));
      console.log('\nInstallers created:');
      installers.forEach(installer => {
        if (installer.files) {
          installer.files.forEach(file => console.log(`  - ${file}`));
        } else if (installer.file) {
          console.log(`  - ${installer.file}`);
        }
      });
      
      return {
        success: true,
        duration,
        appPaths,
        installers
      };
    } catch (error) {
      console.error('\n=== BUILD FAILED ===');
      console.error(error);
      throw error;
    }
  }

  async runQuickBuild() {
    console.log('Starting quick build (no installers)...');
    
    try {
      await this.buildApplication();
      const appPaths = await this.packageElectron();
      
      console.log('\n=== QUICK BUILD COMPLETED ===');
      console.log('Packaged applications:');
      appPaths.forEach(path => console.log(`  - ${path}`));
      
      return {
        success: true,
        appPaths
      };
    } catch (error) {
      console.error('\n=== QUICK BUILD FAILED ===');
      console.error(error);
      throw error;
    }
  }
}

module.exports = BuildManager;

// CLI usage
if (require.main === module) {
  const buildManager = new BuildManager();
  const command = process.argv[2] || 'full';
  
  (async () => {
    try {
      switch (command) {
        case 'clean':
          await buildManager.cleanBuild();
          break;
        case 'deps':
          await buildManager.installDependencies();
          break;
        case 'build':
          await buildManager.buildApplication();
          break;
        case 'package':
          await buildManager.packageElectron();
          break;
        case 'installers':
          await buildManager.createInstallers();
          break;
        case 'quick':
          await buildManager.runQuickBuild();
          break;
        case 'full':
        default:
          await buildManager.runFullBuild();
          break;
      }
    } catch (error) {
      console.error('Build process failed:', error);
      process.exit(1);
    }
  })();
}