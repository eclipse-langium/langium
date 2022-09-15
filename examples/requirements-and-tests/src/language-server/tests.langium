grammar Tests
import "./common"
import "./requirements"

entry TestModel:
    (contact=Contact)?
    (tests+=Test)*;

Test:
    'tst' name=ID ('testFile' '=' testFile=STRING)?
    'tests' requirements+=[Requirement:ID]
    (',' requirements+=[Requirement:ID])*;
