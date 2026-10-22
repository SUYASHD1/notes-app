// Dynamic Grid Table Engine

export class TableBlockModel {
  constructor(options = {}) {
    this.id = options.id || 'tbl_' + Math.random().toString(36).substr(2, 9);
    this.rows = options.rows || 3;
    this.cols = options.cols || 3;
    this.data = options.data || this.createEmptyData(this.rows, this.cols);
  }

  createEmptyData(rows, cols) {
    const data = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(r === 0 ? `Header ${c + 1}` : `R${r}C${c}`);
      }
      data.push(row);
    }
    return data;
  }

  getCellValue(row, col) {
    if (this.data[row] && this.data[row][col] !== undefined) {
      return this.data[row][col];
    }
    return '';
  }

  setCellValue(row, col, value) {
    if (this.data[row] && this.data[row][col] !== undefined) {
      this.data[row][col] = String(value);
      return true;
    }
    return false;
  }

  addRow() {
    const newRow = new Array(this.cols).fill('');
    this.data.push(newRow);
    this.rows++;
    return this.rows;
  }

  addColumn() {
    for (let r = 0; r < this.rows; r++) {
      this.data[r].push(r === 0 ? `Header ${this.cols + 1}` : '');
    }
    this.cols++;
    return this.cols;
  }
}
