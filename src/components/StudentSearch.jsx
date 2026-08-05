import { Search } from 'lucide-react';

export default function StudentSearch({ nameSearch, usnSearch, onNameChange, onUsnChange }) {
  return (
    <div className="student-search-fields">
      <div className="student-search-input">
        <Search size={14} aria-hidden="true" />
        <input
          id="student-name-search"
          aria-label="Search student name"
          placeholder="Search student name…"
          value={nameSearch}
          onChange={event => onNameChange(event.target.value)}
          className="input-field"
        />
      </div>
      <div className="student-search-input">
        <Search size={14} aria-hidden="true" />
        <input
          id="usn-search"
          aria-label="Search USN"
          placeholder="Search USN…"
          value={usnSearch}
          onChange={event => onUsnChange(event.target.value.toUpperCase())}
          className="input-field"
        />
      </div>
    </div>
  );
}
