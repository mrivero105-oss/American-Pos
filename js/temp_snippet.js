updateCustomerSearchHighlight(items) {
    items.forEach((item, index) => {
        if (index === this.customerSearchHighlightIndex) {
            item.classList.add('bg-slate-100', 'dark:bg-slate-700');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('bg-slate-100', 'dark:bg-slate-700');
        }
    });
}
