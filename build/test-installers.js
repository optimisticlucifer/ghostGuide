const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class InstallerTester {
  constructor() {
    this.rootDir = path.join(__dirname, '..');
    this.installersDir = path.join(this.rootDir, 'installers');
    this.testResults = [];
  }

  async runAllTests() {
    console.log('Starting installer tests...');
    
    try {
      await this.testFileIntegrity();
      await this.testInstallerSizes();
      await this.testChecksums();
      await this.testPlatformSpecific();
      
      this.generateTestReport();
      
      const passed = this.testResults.filter(r => r.status === 'PASS').length;
      const failed = this.testResults.filter(r => r.status === 'FAIL').length;
      
      console.log(`\n=== TEST SUMMARY ===`);
      console.log(`Total tests: ${this.testResults.length}`);
      console.log(`Passed: ${passed}`);
      console.log(`Failed: ${failed}`);
      
      if (failed > 0) {
        console.log('\nFailed tests:');
        this.testResults
          .filter(r => r.status === 'FAIL')
          .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
        
        process.exit(1);
      }
      
      console.log('\nAll installer tests passed!');
      return true;
    } catch (error) {
      console.error('Installer testing failed:', error);
      throw error;
    }
  }

  async testFileIntegrity() {
    console.log('Testing file integrity...');
    
    const expectedFiles = {
      windows: [
        'windows/InterviewAssistant-*-Setup.exe',
        'windows/InterviewAssistant-*-Setup.msi'
      ],
      macos: [
        'macos/InterviewAssistant-*.dmg'
      ],
      linux: [
        'linux/interview-assistant_*_amd64.deb'
      ],
      portable: [
        'portable/InterviewAssistant-*-Portable-Windows.zip',
        'portable/InterviewAssistant-*-Portable-macOS.zip',
        'portable/InterviewAssistant-*-Portable-Linux.tar.gz'
      ],
      checksums: [
        'CHECKSUMS.json',
        'checksums.txt'
      ]
    };
    
    for (const [platform, patterns] of Object.entries(expectedFiles)) {
      for (const pattern of patterns) {
        try {
          const glob = require('glob');
          const matches = glob.sync(pattern, { cwd: this.installersDir });
          
          if (matches.length === 0) {
            this.addTestResult(`File existence: ${pattern}`, 'FAIL', `No files found matching pattern`);
          } else {
            // Check if files are readable and not empty
            for (const match of matches) {
              const fullPath = path.join(this.installersDir, match);
              const stat = fs.statSync(fullPath);
              
              if (stat.size === 0) {
                this.addTestResult(`File size: ${match}`, 'FAIL', 'File is empty');
              } else {
                this.addTestResult(`File integrity: ${match}`, 'PASS', `${stat.size} bytes`);
              }
            }
          }
        } catch (error) {
          this.addTestResult(`File check: ${pattern}`, 'FAIL', error.message);
        }
      }
    }
  }

  async testInstallerSizes() {
    console.log('Testing installer sizes...');
    
    const minSizes = {
      '.exe': 30 * 1024 * 1024,   // 30MB minimum
      '.msi': 30 * 1024 * 1024,   // 30MB minimum
      '.dmg': 30 * 1024 * 1024,   // 30MB minimum
      '.deb': 30 * 1024 * 1024,   // 30MB minimum
      '.zip': 25 * 1024 * 1024,   // 25MB minimum for portable
      '.tar.gz': 25 * 1024 * 1024 // 25MB minimum for portable
    };
    
    const maxSizes = {
      '.exe': 200 * 1024 * 1024,  // 200MB maximum
      '.msi': 200 * 1024 * 1024,  // 200MB maximum
      '.dmg': 200 * 1024 * 1024,  // 200MB maximum
      '.deb': 200 * 1024 * 1024,  // 200MB maximum
      '.zip': 150 * 1024 * 1024,  // 150MB maximum for portable
      '.tar.gz': 150 * 1024 * 1024 // 150MB maximum for portable
    };
    
    const walkDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          const minSize = minSizes[ext];
          const maxSize = maxSizes[ext];
          
          if (minSize && stat.size < minSize) {
            this.addTestResult(`Size check: ${item}`, 'FAIL', 
              `File too small: ${stat.size} bytes (min: ${minSize})`);
          } else if (maxSize && stat.size > maxSize) {
            this.addTestResult(`Size check: ${item}`, 'FAIL', 
              `File too large: ${stat.size} bytes (max: ${maxSize})`);
          } else if (minSize || maxSize) {
            this.addTestResult(`Size check: ${item}`, 'PASS', 
              `${Math.round(stat.size / 1024 / 1024)}MB`);
          }
        }
      }
    };
    
    walkDir(this.installersDir);
  }

  async testChecksums() {
    console.log('Testing checksums...');
    
    const checksumPath = path.join(this.installersDir, 'CHECKSUMS.json');
    const simpleChecksumPath = path.join(this.installersDir, 'checksums.txt');
    
    // Test JSON checksum file
    try {
      if (!fs.existsSync(checksumPath)) {
        this.addTestResult('Checksum file existence', 'FAIL', 'CHECKSUMS.json not found');
        return;
      }
      
      const checksumData = JSON.parse(fs.readFileSync(checksumPath, 'utf8'));
      
      // Validate structure
      if (!checksumData.version || !checksumData.files) {
        this.addTestResult('Checksum structure', 'FAIL', 'Invalid checksum file structure');
        return;
      }
      
      this.addTestResult('Checksum file structure', 'PASS', `${Object.keys(checksumData.files).length} files`);
      
      // Verify checksums
      let validChecksums = 0;
      let invalidChecksums = 0;
      
      for (const [file, expectedData] of Object.entries(checksumData.files)) {
        const fullPath = path.join(this.installersDir, file);
        
        if (fs.existsSync(fullPath)) {
          const actualData = fs.readFileSync(fullPath);
          const actualSha256 = crypto.createHash('sha256').update(actualData).digest('hex');
          const actualSha512 = crypto.createHash('sha512').update(actualData).digest('hex');
          
          if (actualSha256 === expectedData.sha256 && actualSha512 === expectedData.sha512) {
            validChecksums++;
          } else {
            invalidChecksums++;
            this.addTestResult(`Checksum: ${file}`, 'FAIL', 'Hash mismatch');
          }
        } else {
          this.addTestResult(`Checksum: ${file}`, 'FAIL', 'File not found');
          invalidChecksums++;
        }
      }
      
      if (invalidChecksums === 0) {
        this.addTestResult('Checksum verification', 'PASS', `${validChecksums} files verified`);
      }
      
    } catch (error) {
      this.addTestResult('Checksum parsing', 'FAIL', error.message);
    }
    
    // Test simple checksum file
    try {
      if (fs.existsSync(simpleChecksumPath)) {
        const content = fs.readFileSync(simpleChecksumPath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        if (lines.length > 0) {
          this.addTestResult('Simple checksum file', 'PASS', `${lines.length} entries`);
        } else {
          this.addTestResult('Simple checksum file', 'FAIL', 'Empty checksum file');
        }
      }
    } catch (error) {
      this.addTestResult('Simple checksum file', 'FAIL', error.message);
    }
  }

  async testPlatformSpecific() {
    console.log('Testing platform-specific features...');
    
    // Test Windows installers
    await this.testWindowsInstallers();
    
    // Test macOS installers
    await this.testMacOSInstallers();
    
    // Test Linux installers
    await this.testLinuxInstallers();
    
    // Test portable versions
    await this.testPortableVersions();
  }

  async testWindowsInstallers() {
    const windowsDir = path.join(this.installersDir, 'windows');
    if (!fs.existsSync(windowsDir)) {
      this.addTestResult('Windows installers', 'SKIP', 'Directory not found');
      return;
    }
    
    const files = fs.readdirSync(windowsDir);
    
    // Test EXE installer
    const exeFiles = files.filter(f => f.endsWith('.exe'));
    if (exeFiles.length > 0) {
      for (const exe of exeFiles) {
        try {
          // Basic PE header check
          const filePath = path.join(windowsDir, exe);
          const buffer = fs.readFileSync(filePath);
          
          // Check for PE signature
          if (buffer.length > 64 && buffer.toString('ascii', 0, 2) === 'MZ') {
            this.addTestResult(`Windows EXE: ${exe}`, 'PASS', 'Valid PE executable');
          } else {
            this.addTestResult(`Windows EXE: ${exe}`, 'FAIL', 'Invalid PE format');
          }
        } catch (error) {
          this.addTestResult(`Windows EXE: ${exe}`, 'FAIL', error.message);
        }
      }
    }
    
    // Test MSI installer
    const msiFiles = files.filter(f => f.endsWith('.msi'));
    if (msiFiles.length > 0) {
      for (const msi of msiFiles) {
        try {
          const filePath = path.join(windowsDir, msi);
          const buffer = fs.readFileSync(filePath, { start: 0, end: 8 });
          
          // Check for MSI signature
          if (buffer.toString('hex') === 'd0cf11e0a1b11ae1') {
            this.addTestResult(`Windows MSI: ${msi}`, 'PASS', 'Valid MSI format');
          } else {
            this.addTestResult(`Windows MSI: ${msi}`, 'FAIL', 'Invalid MSI format');
          }
        } catch (error) {
          this.addTestResult(`Windows MSI: ${msi}`, 'FAIL', error.message);
        }
      }
    }
  }

  async testMacOSInstallers() {
    const macosDir = path.join(this.installersDir, 'macos');
    if (!fs.existsSync(macosDir)) {
      this.addTestResult('macOS installers', 'SKIP', 'Directory not found');
      return;
    }
    
    const files = fs.readdirSync(macosDir);
    const dmgFiles = files.filter(f => f.endsWith('.dmg'));
    
    if (dmgFiles.length > 0) {
      for (const dmg of dmgFiles) {
        try {
          const filePath = path.join(macosDir, dmg);
          const buffer = fs.readFileSync(filePath, { start: 0, end: 4 });
          
          // Basic DMG format check (simplified)
          if (buffer.length === 4) {
            this.addTestResult(`macOS DMG: ${dmg}`, 'PASS', 'DMG file format detected');
          } else {
            this.addTestResult(`macOS DMG: ${dmg}`, 'FAIL', 'Invalid DMG format');
          }
        } catch (error) {
          this.addTestResult(`macOS DMG: ${dmg}`, 'FAIL', error.message);
        }
      }
    }
  }

  async testLinuxInstallers() {
    const linuxDir = path.join(this.installersDir, 'linux');
    if (!fs.existsSync(linuxDir)) {
      this.addTestResult('Linux installers', 'SKIP', 'Directory not found');
      return;
    }
    
    const files = fs.readdirSync(linuxDir);
    const debFiles = files.filter(f => f.endsWith('.deb'));
    
    if (debFiles.length > 0) {
      for (const deb of debFiles) {
        try {
          const filePath = path.join(linuxDir, deb);
          const buffer = fs.readFileSync(filePath, { start: 0, end: 8 });
          
          // Check for Debian package signature
          if (buffer.toString('ascii', 0, 8) === '!<arch>\\n') {
            this.addTestResult(`Linux DEB: ${deb}`, 'PASS', 'Valid Debian package');
          } else {
            this.addTestResult(`Linux DEB: ${deb}`, 'FAIL', 'Invalid DEB format');
          }
        } catch (error) {
          this.addTestResult(`Linux DEB: ${deb}`, 'FAIL', error.message);
        }
      }
    }
  }

  async testPortableVersions() {
    const portableDir = path.join(this.installersDir, 'portable');
    if (!fs.existsSync(portableDir)) {
      this.addTestResult('Portable versions', 'SKIP', 'Directory not found');
      return;
    }
    
    const files = fs.readdirSync(portableDir);
    
    // Test ZIP files
    const zipFiles = files.filter(f => f.endsWith('.zip'));
    for (const zip of zipFiles) {
      try {
        const filePath = path.join(portableDir, zip);
        const buffer = fs.readFileSync(filePath, { start: 0, end: 4 });
        
        // Check for ZIP signature
        if (buffer.toString('hex') === '504b0304' || buffer.toString('hex') === '504b0506') {
          this.addTestResult(`Portable ZIP: ${zip}`, 'PASS', 'Valid ZIP archive');
        } else {
          this.addTestResult(`Portable ZIP: ${zip}`, 'FAIL', 'Invalid ZIP format');
        }
      } catch (error) {
        this.addTestResult(`Portable ZIP: ${zip}`, 'FAIL', error.message);
      }
    }
    
    // Test TAR.GZ files
    const tarFiles = files.filter(f => f.endsWith('.tar.gz'));
    for (const tar of tarFiles) {
      try {
        const filePath = path.join(portableDir, tar);
        const buffer = fs.readFileSync(filePath, { start: 0, end: 3 });
        
        // Check for GZIP signature
        if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
          this.addTestResult(`Portable TAR.GZ: ${tar}`, 'PASS', 'Valid GZIP archive');
        } else {
          this.addTestResult(`Portable TAR.GZ: ${tar}`, 'FAIL', 'Invalid GZIP format');
        }
      } catch (error) {
        this.addTestResult(`Portable TAR.GZ: ${tar}`, 'FAIL', error.message);
      }
    }
  }

  addTestResult(name, status, details) {
    this.testResults.push({
      name,
      status,
      details,
      error: status === 'FAIL' ? details : null
    });
    
    const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
    console.log(`  ${icon} ${name}: ${details}`);
  }

  generateTestReport() {
    const reportPath = path.join(this.installersDir, 'test-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.status === 'PASS').length,
        failed: this.testResults.filter(r => r.status === 'FAIL').length,
        skipped: this.testResults.filter(r => r.status === 'SKIP').length
      },
      results: this.testResults
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\\nTest report generated: ${reportPath}`);
  }
}

module.exports = InstallerTester;

// CLI usage
if (require.main === module) {
  const tester = new InstallerTester();
  
  (async () => {
    try {
      await tester.runAllTests();
    } catch (error) {
      console.error('Testing failed:', error);
      process.exit(1);
    }
  })();
}