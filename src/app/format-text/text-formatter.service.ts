import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TextFormatterService {

  formatTimestamp(timestamp: number): string {
    try {
      // Нормализуем timestamp
      let normalizedTimestamp: number;

      if (!timestamp || timestamp === 0) {
        normalizedTimestamp = Date.now();
      } else if (timestamp < 1000000000000) {
        // Если timestamp в секундах (меньше 13 знаков)
        normalizedTimestamp = timestamp * 1000;
      } else {
        // Если уже в миллисекундах
        normalizedTimestamp = timestamp;
      }

      const date = new Date(normalizedTimestamp);

      if (isNaN(date.getTime())) {
        return 'Некорректная дата';
      }

      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit' // Добавим секунды для отладки
      });

    } catch (error) {
      console.error('Ошибка форматирования timestamp:', timestamp, error);
      return 'Ошибка даты';
    }
  }

  formatMessageText(text: string): string {
    if (!text) {
      return text;
    }

    // Удаляем текст от "[Документ" до "]" включительно и "Источники:" до конца
    // Удаляем все вхождения [Документ...] блоков
    const documentPattern = /\[Документ[^\]]*\]/g;
    text = text.replace(documentPattern, '');
    
    // Удаляем текст от "Источники:" до конца
    const sourcesIndex = text.indexOf('Источники:');
    if (sourcesIndex !== -1) {
      text = text.substring(0, sourcesIndex).trim();
    }

    // Сначала обрабатываем экранированные символы
    let processedText = text
      .replace(/\\n/g, '\n')  // Заменяем \n на реальные переносы строк
      .replace(/\\\\/g, '\\'); // Заменяем \\ на \

    // Если текст содержит "Например:", применяем специальное форматирование
    if (processedText.includes('Например:')) {
      return this.formatExampleSection(processedText);
    }

    // Для обычного текста просто заменяем переносы строк на <br>
    return processedText.replace(/\n/g, '<br>');
  }

  private formatExampleSection(text: string): string {
    // Разбиваем текст на строки
    const lines = text.split('\n');
    let formattedText = '';
    let inExampleSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.includes('Например:')) {
        inExampleSection = true;
        formattedText += line + '<br>';
        continue;
      }

      if (inExampleSection && line.startsWith('-')) {
        // Если строка начинается с "-", добавляем её на новую строку
        formattedText += '<br>' + line;
      } else {
        formattedText += line;
      }

      // Добавляем перенос строки между абзацами
      if (i < lines.length - 1) {
        formattedText += '<br>';
      }
    }

    return formattedText;
  }


    // Форматирование списка страниц
    formatPages(pages: number[]): string {
      if (!pages || pages.length === 0) {
        return '';
      }
      return pages.map((p: number) => p + ' c.').join(', ');
    }

    removeExtension(filename: string): string {
      if (!filename) {
        return '';
      }

      const parts = filename.split('.');
      if (parts.length > 1) {
        parts.pop(); // удаляем последнюю часть (расширение)
        return parts.join('.');
      }
      return filename;
    }

    shortenFileName(filename: string): string {
      const baseName = this.removeExtension(filename);
      if (!baseName) {
        return '';
      }
      if (baseName.length > 12) {
        return baseName.slice(0, 12) + '..';
      }
      return baseName;
    }

}
