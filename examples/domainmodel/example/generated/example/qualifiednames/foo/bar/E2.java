package example.qualifiednames.foo.bar;

class E2 extends E1 {
    private E2 next;
    private baz.E3 other;
    private baz.nested.E5 nested;

    public void setNext(E2 next) {
        this.next = next;
    }

    public E2 getNext() {
        return next;
    }

    public void setOther(baz.E3 other) {
        this.other = other;
    }

    public baz.E3 getOther() {
        return other;
    }

    public void setNested(baz.nested.E5 nested) {
        this.nested = nested;
    }

    public baz.nested.E5 getNested() {
        return nested;
    }
}
