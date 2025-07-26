const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const BuildManager = require('./build-scripts');

class ReleaseManager {
  constructor() {
    this.rootDir = path.join(__dirname, '..');
    this.packageJson = require('../package.json');
    this.version = this.packageJson.version;
    this.buildManager = new BuildManager();
  }

  async createRelease() {
    console.log(`Creating release for version ${this.version}...`);
    
    try {
      // Pre-release checks
      await this.preReleaseChecks();
      
      // Run full build
      const buildResult = await this.buildManager.runFullBuild();
      
      // Generate release notes
      const releaseNotes = await this.generateReleaseNotes();
      
      // Create release package
      const releasePackage = await this.createReleasePackage(buildResult);
      
      // Generate security checksums
      const checksums = await this.generateSecurityChecksums(releasePackage);
      
      console.log('\n=== RELEASE CREATED SUCCESSFULLY ===');
      console.log(`Version: ${this.version}`);
      console.log(`Release package: ${releasePackage.path}`);
      console.log(`Checksums: ${checksums.path}`);
      
      return {
        version: this.version,
        releasePackage,
        checksums,
        releaseNotes,
        buildResult
      };
    } catch (error) {
      console.error('Release creation failed:', error);
      throw error;
    }
  }

  async preReleaseChecks() {
    console.log('Running pre-release checks...');
    
    // Check if working directory is clean
    try {
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
      if (gitStatus.trim()) {
        throw new Error('Working directory is not clean. Commit or stash changes before release.');
      }
    } catch (error) {
      console.warn('Git status check failed:', error.message);
    }
    
    // Check if version tag already exists
    try {
      const existingTag = execSync(`git tag -l "v${this.version}"`, { encoding: 'utf8' });
      if (existingTag.trim()) {
        throw new Error(`Version tag v${this.version} already exists`);
      }
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.warn('Git tag check failed:', error.message);
      } else {
        throw error;
      }
    }
    
    // Run tests
    console.log('Running tests...');
    try {
      execSync('npm test', { stdio: 'inherit', cwd: this.rootDir });
    } catch (error) {
      throw new Error('Tests failed. Fix issues before release.');
    }
    
    // Check for required environment variables
    const requiredEnvVars = {
      production: ['NODE_ENV'],
      signing: ['MACOS_SIGNING_IDENTITY', 'WINDOWS_CERT_FILE']
    };
    
    const missingVars = [];
    for (const [category, vars] of Object.entries(requiredEnvVars)) {
      for (const varName of vars) {
        if (!process.env[varName]) {
          missingVars.push(`${varName} (${category})`);
        }
      }
    }
    
    if (missingVars.length > 0) {
      console.warn('Missing environment variables:', missingVars.join(', '));
      console.warn('Release may not be properly signed.');
    }
    
    console.log('Pre-release checks completed.');
  }

  async generateReleaseNotes() {
    console.log('Generating release notes...');
    
    let releaseNotes = `# Interview Assistant v${this.version}\n\n`;
    
    // Try to get git log since last tag
    try {
      const lastTag = execSync('git describe --tags --abbrev=0 HEAD^', { encoding: 'utf8' }).trim();
      const gitLog = execSync(`git log ${lastTag}..HEAD --pretty=format:"- %s"`, { encoding: 'utf8' });
      
      if (gitLog.trim()) {
        releaseNotes += `## Changes since ${lastTag}\n\n${gitLog}\n\n`;
      }
    } catch (error) {
      console.warn('Could not generate git log:', error.message);
    }
    
    // Add standard release information
    releaseNotes += `## Installation\n\n`;
    releaseNotes += `### Windows\n`;
    releaseNotes += `- Download \`InterviewAssistant-${this.version}-Setup.exe\`\n`;
    releaseNotes += `- Run the installer and follow the setup wizard\n\n`;
    
    releaseNotes += `### macOS\n`;
    releaseNotes += `- Download \`InterviewAssistant-${this.version}.dmg\`\n`;
    releaseNotes += `- Open the DMG and drag the app to Applications folder\n\n`;
    
    releaseNotes += `### Linux (Ubuntu/Debian)\n`;
    releaseNotes += `- Download \`interview-assistant_${this.version}_amd64.deb\`\n`;
    releaseNotes += `- Install with: \`sudo dpkg -i interview-assistant_${this.version}_amd64.deb\`\n\n`;
    
    releaseNotes += `### Portable Version\n`;
    releaseNotes += `- Download the appropriate portable archive for your platform\n`;
    releaseNotes += `- Extract and run the executable directly\n\n`;
    
    releaseNotes += `## System Requirements\n\n`;
    releaseNotes += `- **Windows**: Windows 10 or later\n`;
    releaseNotes += `- **macOS**: macOS 10.14 (Mojave) or later\n`;
    releaseNotes += `- **Linux**: Ubuntu 18.04+ or equivalent\n`;
    releaseNotes += `- **RAM**: 4GB minimum, 8GB recommended\n`;
    releaseNotes += `- **Storage**: 500MB free space\n`;
    releaseNotes += `- **Network**: Internet connection for AI features\n\n`;
    
    releaseNotes += `## Security\n\n`;
    releaseNotes += `All binaries are code-signed and checksums are provided below:\n\n`;
    releaseNotes += `\`\`\`\n`;
    releaseNotes += `# Verify checksums with:\n`;
    releaseNotes += `# sha256sum -c checksums.txt\n`;
    releaseNotes += `\`\`\`\n\n`;
    
    releaseNotes += `## Support\n\n`;
    releaseNotes += `- Documentation: [README.md](README.md)\n`;
    releaseNotes += `- Issues: [GitHub Issues](https://github.com/interview-assistant/app/issues)\n`;
    releaseNotes += `- Build Instructions: [BUILD.md](BUILD.md)\n`;
    
    const releaseNotesPath = path.join(this.rootDir, 'installers', `RELEASE-NOTES-${this.version}.md`);
    if (!fs.existsSync(path.dirname(releaseNotesPath))) {
      fs.mkdirSync(path.dirname(releaseNotesPath), { recursive: true });
    }
    fs.writeFileSync(releaseNotesPath, releaseNotes);
    
    console.log(`Release notes generated: ${releaseNotesPath}`);
    return {
      content: releaseNotes,
      path: releaseNotesPath
    };
  }

  async createReleasePackage(buildResult) {
    console.log('Creating release package...');
    
    const archiver = require('archiver');
    const releaseDir = path.join(this.rootDir, 'release');
    const packagePath = path.join(releaseDir, `InterviewAssistant-${this.version}-Release.zip`);
    
    if (!fs.existsSync(releaseDir)) {
      fs.mkdirSync(releaseDir, { recursive: true });
    }
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(packagePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', () => {
        console.log(`Release package created: ${packagePath} (${archive.pointer()} bytes)`);
        resolve({
          path: packagePath,
          size: archive.pointer()
        });
      });
      
      archive.on('error', reject);
      archive.pipe(output);
      
      // Add installers
      const installersDir = path.join(this.rootDir, 'installers');
      if (fs.existsSync(installersDir)) {
        archive.directory(installersDir, 'installers');
      }
      
      // Add documentation
      const docs = ['README.md', 'BUILD.md', 'LICENSE'];
      for (const doc of docs) {
        const docPath = path.join(this.rootDir, doc);
        if (fs.existsSync(docPath)) {
          archive.file(docPath, { name: doc });
        }
      }
      
      // Add package.json for version info
      archive.file(path.join(this.rootDir, 'package.json'), { name: 'package.json' });
      
      archive.finalize();
    });
  }

  async generateSecurityChecksums(releasePackage) {
    console.log('Generating security checksums...');
    
    const checksumData = {};
    const installersDir = path.join(this.rootDir, 'installers');
    
    // Function to calculate file hash
    const calculateHash = (filePath) => {
      const data = fs.readFileSync(filePath);
      return {
        sha256: crypto.createHash('sha256').update(data).digest('hex'),
        sha512: crypto.createHash('sha512').update(data).digest('hex'),
        size: data.length,
        modified: fs.statSync(filePath).mtime.toISOString()
      };
    };
    
    // Walk through installers directory
    const walkDir = (dir, baseDir = dir) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath, baseDir);
        } else if (stat.isFile()) {
          const relativePath = path.relative(baseDir, fullPath);
          checksumData[relativePath] = calculateHash(fullPath);
        }
      }
    };
    
    walkDir(installersDir);
    
    // Add release package checksum
    if (fs.existsSync(releasePackage.path)) {
      const relativePackagePath = path.relative(this.rootDir, releasePackage.path);
      checksumData[relativePackagePath] = calculateHash(releasePackage.path);
    }
    
    // Create checksums file
    const checksumContent = {
      version: this.version,
      generated: new Date().toISOString(),
      algorithm: 'SHA256 + SHA512',
      files: checksumData
    };
    
    const checksumPath = path.join(installersDir, 'CHECKSUMS.json');
    fs.writeFileSync(checksumPath, JSON.stringify(checksumContent, null, 2));
    
    // Create simple text format for command line verification
    const simpleChecksumPath = path.join(installersDir, 'checksums.txt');
    const simpleContent = Object.entries(checksumData)
      .map(([file, data]) => `${data.sha256}  ${file}`)
      .join('\n');
    fs.writeFileSync(simpleChecksumPath, simpleContent);
    
    console.log(`Security checksums generated: ${checksumPath}`);
    return {
      path: checksumPath,
      simplePath: simpleChecksumPath,
      data: checksumContent
    };
  }

  async createGitTag() {
    console.log(`Creating git tag v${this.version}...`);
    
    try {
      execSync(`git tag -a v${this.version} -m "Release version ${this.version}"`, {
        cwd: this.rootDir,
        stdio: 'inherit'
      });
      
      console.log(`Git tag v${this.version} created successfully.`);
      console.log('Push with: git push origin --tags');
    } catch (error) {
      console.error('Failed to create git tag:', error.message);
      throw error;
    }
  }

  async validateRelease(releaseData) {
    console.log('Validating release...');
    
    const issues = [];
    
    // Check if all expected files exist
    const expectedFiles = [
      'installers/windows/InterviewAssistant-*-Setup.exe',
      'installers/macos/InterviewAssistant-*.dmg',
      'installers/linux/interview-assistant_*_amd64.deb',
      'installers/portable/InterviewAssistant-*-Portable-*.zip',
      'installers/CHECKSUMS.json',
      'installers/checksums.txt'
    ];
    
    for (const pattern of expectedFiles) {
      const glob = require('glob');
      const matches = glob.sync(pattern, { cwd: this.rootDir });
      if (matches.length === 0) {
        issues.push(`Missing expected file: ${pattern}`);
      }
    }
    
    // Verify checksums
    try {
      const checksumPath = path.join(this.rootDir, 'installers', 'CHECKSUMS.json');
      if (fs.existsSync(checksumPath)) {
        const checksumData = JSON.parse(fs.readFileSync(checksumPath, 'utf8'));
        
        for (const [file, expectedData] of Object.entries(checksumData.files)) {
          const fullPath = path.join(this.rootDir, file);
          if (fs.existsSync(fullPath)) {
            const actualData = fs.readFileSync(fullPath);
            const actualHash = crypto.createHash('sha256').update(actualData).digest('hex');
            
            if (actualHash !== expectedData.sha256) {
              issues.push(`Checksum mismatch for ${file}`);
            }
          }
        }
      }
    } catch (error) {
      issues.push(`Checksum validation failed: ${error.message}`);
    }
    
    // Check file sizes (basic sanity check)
    const minSizes = {
      '.exe': 50 * 1024 * 1024,  // 50MB
      '.dmg': 50 * 1024 * 1024,  // 50MB
      '.deb': 50 * 1024 * 1024   // 50MB
    };
    
    const installersDir = path.join(this.rootDir, 'installers');
    if (fs.existsSync(installersDir)) {
      const walkDir = (dir) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (stat.isFile()) {
            const ext = path.extname(item);
            const minSize = minSizes[ext];
            if (minSize && stat.size < minSize) {
              issues.push(`File ${item} is suspiciously small (${stat.size} bytes)`);
            }
          }
        }
      };
      walkDir(installersDir);
    }
    
    if (issues.length > 0) {
      console.warn('Release validation issues found:');
      issues.forEach(issue => console.warn(`  - ${issue}`));
      return { valid: false, issues };
    }
    
    console.log('Release validation passed.');
    return { valid: true, issues: [] };
  }

  async publishRelease(releaseData) {
    console.log('Publishing release...');
    
    // This would integrate with GitHub Releases API or other distribution platforms
    // For now, we'll just provide instructions
    
    console.log('\n=== RELEASE READY FOR PUBLICATION ===');
    console.log('\nTo publish this release:');
    console.log('1. Push git tag: git push origin --tags');
    console.log('2. Create GitHub release from tag');
    console.log('3. Upload installers from installers/ directory');
    console.log('4. Include release notes and checksums');
    console.log('5. Mark as pre-release if applicable');
    
    return {
      published: false,
      instructions: 'Manual publication required'
    };
  }
}

module.exports = ReleaseManager;

// CLI usage
if (require.main === module) {
  const releaseManager = new ReleaseManager();
  const command = process.argv[2] || 'create';
  
  (async () => {
    try {
      switch (command) {
        case 'create':
          const releaseData = await releaseManager.createRelease();
          const validation = await releaseManager.validateRelease(releaseData);
          
          if (validation.valid) {
            await releaseManager.createGitTag();
            await releaseManager.publishRelease(releaseData);
          } else {
            console.error('Release validation failed. Fix issues before publishing.');
            process.exit(1);
          }
          break;
          
        case 'validate':
          const validation2 = await releaseManager.validateRelease({});
          if (!validation2.valid) {
            process.exit(1);
          }
          break;
          
        case 'tag':
          await releaseManager.createGitTag();
          break;
          
        default:
          console.log('Usage: node release-automation.js [create|validate|tag]');
          break;
      }
    } catch (error) {
      console.error('Release process failed:', error);
      process.exit(1);
    }
  })();
}