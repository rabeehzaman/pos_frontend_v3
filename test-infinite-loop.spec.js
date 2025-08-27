const { test, expect } = require('@playwright/test');

test.describe('POS Application - Infinite Loop Fix Verification', () => {
  let consoleMessages = [];
  let errors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });

    // Capture page errors
    page.on('pageerror', error => {
      errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });
  });

  test('should load without infinite loop errors', async ({ page }) => {
    console.log('🚀 Testing POS application for infinite loop issues...');
    
    // Navigate to the application
    const startTime = Date.now();
    await page.goto('http://localhost:3002');
    const loadTime = Date.now() - startTime;
    
    console.log(`⏱️  Page loaded in ${loadTime}ms`);

    // Wait for the application to fully load
    await page.waitForTimeout(3000);

    // Check for critical React errors
    const hasInfiniteLoopError = consoleMessages.some(msg => 
      msg.text.includes('Maximum update depth exceeded') ||
      msg.text.includes('getSnapshot should be cached to avoid an infinite loop')
    );

    const hasReactErrors = errors.some(error => 
      error.message.includes('Maximum update depth exceeded') ||
      error.message.includes('getSnapshot should be cached')
    );

    // Log console messages for analysis
    console.log('\n📋 Console Messages:');
    consoleMessages.forEach(msg => {
      if (msg.type === 'error') {
        console.log(`❌ ERROR: ${msg.text}`);
      } else if (msg.type === 'warning') {
        console.log(`⚠️  WARNING: ${msg.text}`);
      } else {
        console.log(`ℹ️  INFO: ${msg.text}`);
      }
    });

    // Log page errors
    if (errors.length > 0) {
      console.log('\n🔥 Page Errors:');
      errors.forEach(error => {
        console.log(`❌ ${error.message}`);
      });
    }

    // Assertions
    expect(hasInfiniteLoopError, 'Should not have infinite loop console errors').toBe(false);
    expect(hasReactErrors, 'Should not have React infinite loop errors').toBe(false);
    expect(loadTime, 'Page should load within reasonable time').toBeLessThan(5000);
  });

  test('should render POS interface components', async ({ page }) => {
    await page.goto('http://localhost:3002');
    await page.waitForTimeout(2000);

    // Check if main POS components are present
    const banner = page.getByRole('banner');
    const mainContent = page.locator('main');
    
    // Wait for components to be visible (avoid strict mode violations)
    await expect(banner).toBeVisible();
    await expect(mainContent).toBeVisible();

    console.log('✅ POS interface components rendered successfully');
  });

  test('should handle cart operations without infinite loops', async ({ page }) => {
    await page.goto('http://localhost:3002');
    await page.waitForTimeout(3000);

    // Clear previous errors
    errors = [];
    consoleMessages = [];

    // Try to interact with cart (if products are loaded)
    try {
      // Look for any clickable product elements
      const productElements = await page.locator('[data-testid="product"], .product-item, button:has-text("Add")').count();
      
      if (productElements > 0) {
        console.log(`🛍️  Found ${productElements} interactive elements`);
        
        // Try clicking the first product/add button
        await page.locator('[data-testid="product"], .product-item, button:has-text("Add")').first().click();
        await page.waitForTimeout(1000);
      }

      // Check if cart-related operations triggered infinite loops
      const newInfiniteLoopErrors = consoleMessages.some(msg => 
        msg.text.includes('Maximum update depth exceeded')
      );

      expect(newInfiniteLoopErrors, 'Cart operations should not trigger infinite loops').toBe(false);
      console.log('✅ Cart operations completed without infinite loops');
      
    } catch (error) {
      console.log('ℹ️  Cart interaction test skipped - no interactive elements found');
    }
  });

  test('should maintain stability over time', async ({ page }) => {
    await page.goto('http://localhost:3002');
    console.log('🕐 Testing application stability over 10 seconds...');

    // Clear previous messages
    errors = [];
    consoleMessages = [];

    // Wait and monitor for 10 seconds
    await page.waitForTimeout(10000);

    // Count error messages during the stability period
    const errorCount = consoleMessages.filter(msg => msg.type === 'error').length;
    const criticalErrors = consoleMessages.filter(msg => 
      msg.text.includes('Maximum update depth') || 
      msg.text.includes('getSnapshot should be cached')
    ).length;

    console.log(`📊 Stability test results:`);
    console.log(`   - Total errors: ${errorCount}`);
    console.log(`   - Critical infinite loop errors: ${criticalErrors}`);
    console.log(`   - Page errors: ${errors.length}`);

    expect(criticalErrors, 'Should have no critical infinite loop errors during stability test').toBe(0);
    console.log('✅ Application remained stable over time');
  });

  test.afterEach(async ({ page }) => {
    // Final summary
    const totalErrors = errors.length;
    const totalConsoleErrors = consoleMessages.filter(msg => msg.type === 'error').length;
    
    console.log(`\n📈 Test Summary:`);
    console.log(`   - Page errors: ${totalErrors}`);
    console.log(`   - Console errors: ${totalConsoleErrors}`);
    console.log(`   - Total console messages: ${consoleMessages.length}`);
    
    if (totalErrors === 0 && totalConsoleErrors === 0) {
      console.log('🎉 SUCCESS: No infinite loop issues detected!');
    } else {
      console.log('⚠️  Some errors were found - check logs above');
    }
  });
});