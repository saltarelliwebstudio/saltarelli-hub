interface CategorySelectProps {
  value: string;
  account: string;
  onChange: (value: string) => void;
}

const personalCategories = [
  'Food', 'Transportation', 'Education', 'Gifts', 'Personal',
  'Haircut', 'Clothing', 'Entertainment', 'Internal Transfer', 'Refund',
];

const businessCategories = [
  'Software/Apps', 'Education', 'Office Supplies',
  'Income – E-Transfer', 'Income – Stripe', 'Income – Cash',
  'Internal Transfer', 'Refund',
];

const savingsCategories = [
  'Internal Transfer', 'Interest', 'Deposit', 'Withdrawal',
];

function getCategoriesForAccount(account: string): string[] {
  switch (account) {
    case 'business': return businessCategories;
    case 'savings': return savingsCategories;
    default: return personalCategories;
  }
}

export default function CategorySelect({ value, account, onChange }: CategorySelectProps) {
  const categories = getCategoriesForAccount(account);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {categories.map((cat) => (
        <option key={cat} value={cat}>{cat}</option>
      ))}
    </select>
  );
}
