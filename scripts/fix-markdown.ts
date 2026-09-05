#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

class MarkdownFixer {
  private booksDir = join(process.cwd(), 'src', 'content', 'books');
  private fixCount = 0;
  private filesFixed = 0;

  private fixContent(content: string, filename: string): string {
    let fixed = content;
    let changes = 0;

    // Debug: check if the file contains any backticks at all
    const allBackticks = content.match(/`/g);
    if (allBackticks) {
      console.log(`  ${filename}: Found ${allBackticks.length} total backticks`);
    }

    // Fix all common Chinese name/place patterns with backticks
    const patterns = [
      { regex: /Ch`ien/g, replacement: "Ch'ien", desc: "Ch`ien" },
      { regex: /P`ang/g, replacement: "P'ang", desc: "P`ang" },
      { regex: /Ch`i/g, replacement: "Ch'i", desc: "Ch`i" },
      { regex: /Ch`u/g, replacement: "Ch'u", desc: "Ch`u" },  
      { regex: /Ch`in/g, replacement: "Ch'in", desc: "Ch`in" },
      { regex: /Ts`ao/g, replacement: "Ts'ao", desc: "Ts`ao" },
      { regex: /`([a-z]{1,2})\s+State/g, replacement: '$1 State', desc: "state patterns" },
      { regex: /`([a-z]{1,3})\s+(?=[A-Z])/g, replacement: '$1 ', desc: "short words before caps" },
      { regex: /(?<=\s)`([a-z]{1,3})(?=\s)/g, replacement: '$1', desc: "isolated short words" },
    ];

    for (const pattern of patterns) {
      const matches = fixed.match(pattern.regex);
      if (matches) {
        console.log(`  Found ${matches.length} ${pattern.desc} patterns: ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`);
        fixed = fixed.replace(pattern.regex, pattern.replacement);
        changes += matches.length;
      }
    }

    // Fix any remaining unmatched backticks by removing them
    // This handles cases where backticks appear at line ends or in odd numbers
    const lines = fixed.split('\n');
    const fixedLines = lines.map(line => {
      const backtickCount = (line.match(/`/g) || []).length;
      
      // If odd number of backticks and no clear code pattern, remove orphaned backticks
      if (backtickCount % 2 !== 0) {
        // Check if this looks like intentional code (has common code indicators)
        const hasCodeIndicators = /\b(function|var|const|let|return|if|else|class|import|export)\b/.test(line);
        
        if (!hasCodeIndicators) {
          // Remove orphaned backticks
          const orphanedBackticks = line.match(/`(?![^`]*`)/g) || [];
          changes += orphanedBackticks.length;
          return line.replace(/`(?![^`]*`)/g, '');
        }
      }
      
      return line;
    });

    this.fixCount += changes;
    return fixedLines.join('\n');
  }

  public fix() {
    console.log('🔧 Fixing markdown formatting issues...\n');
    
    const bookDirs = readdirSync(this.booksDir);
    console.log(`Found ${bookDirs.length} book directories: ${bookDirs.join(', ')}`);
    
    for (const bookDir of bookDirs) {
      const indexPath = join(this.booksDir, bookDir, 'index.md');
      console.log(`Processing ${bookDir}...`);
      try {
        const originalContent = readFileSync(indexPath, 'utf-8');
        console.log(`  Read ${originalContent.length} characters from ${bookDir}`);
        
        const fixedContent = this.fixContent(originalContent, bookDir);
        
        if (originalContent !== fixedContent) {
          writeFileSync(indexPath, fixedContent, 'utf-8');
          this.filesFixed++;
          console.log(`✅ Fixed ${bookDir}/index.md`);
        } else {
          console.log(`  No changes needed for ${bookDir}`);
        }
      } catch (error) {
        console.warn(`⚠️  Could not process ${indexPath}: ${error}`);
      }
    }
    
    this.printSummary(bookDirs.length);
  }

  private printSummary(totalFiles: number) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 MARKDOWN FIXING SUMMARY');
    console.log('='.repeat(50));
    console.log(`Files processed: ${totalFiles}`);
    console.log(`Files modified: ${this.filesFixed}`);
    console.log(`Total fixes applied: ${this.fixCount}`);
    
    if (this.fixCount === 0) {
      console.log('✨ No formatting issues found - all files are clean!');
    } else {
      console.log(`🎉 Successfully fixed ${this.fixCount} formatting issues!`);
      console.log('\n💡 Your markdown is now consistent for both web and EPUB output.');
    }
    console.log('='.repeat(50) + '\n');
  }
}

// Run the fixer
const fixer = new MarkdownFixer();
fixer.fix();

export { MarkdownFixer };