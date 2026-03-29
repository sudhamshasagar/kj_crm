// utils/printHelper.js
export const handleThermalPrint = (contentHtml) => {
  const printWindow = window.open("", "", "width=450,height=600");

  printWindow.document.write(`
    <html>
      <head>
        <title>Thermal Print</title>
        <style>
          /* Basic Reset */
          body { margin: 0; padding: 0; }
          /* Import your CSS logic here or use a style block */
          @page { size: 80mm auto; margin: 0; }
          .thermal-wrapper { width: 80mm; margin: 0 auto; }
        </style>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>
        <div class="thermal-wrapper">
          ${contentHtml}
        </div>
        <script>
          window.onload = () => {
            window.focus();
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};